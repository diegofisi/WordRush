import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { BossFrame } from '@shared/contract';
import { parseThreadCount } from '@shared/config/env';
import type { BrainIdle, BrainReady, BrainRequest, BrainResponse } from './brain.worker';

/**
 * Owns the worker threads the brain runs on, and turns their messages into
 * promises.
 *
 * Two pools, each thread with its own copy of the connectome (~90 MB):
 *
 *   deciders  answer the fly's turns. A decision is about seven seconds of
 *             wall time, and one thread served every room in a queue, so two
 *             rooms halved her pace and four pushed decisions past their
 *             timeout. A request goes to the thread with the fewest in flight.
 *   streamers feed the brain panel, one room each. They were one thread that
 *             switched off as soon as two rooms watched at once.
 *
 * Sized for three simultaneous boss rooms (2026-09-15); `BOSS_DECIDERS` and
 * `BOSS_STREAMS` override the counts where memory or cores are short. More
 * threads than cores buys nothing: on one vCPU three decisions still take
 * three times as long, they just all finish inside the timeout.
 */
interface Decider {
  worker: Worker;
  inFlight: number;
}

interface Streamer {
  worker: Worker;
  /** The room whose board this thread is streaming; null while idle. */
  room: string | null;
}

const EMPTY_TELEMETRY = {
  raster: [],
  voltage: [],
  populations: [],
  excitatory: 0,
  inhibitory: 0,
  cloud: [],
  stimulus: [],
};

@Injectable()
export class BrainWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrainWorkerService.name);
  private readonly deciders: Decider[] = [];
  private readonly streamers: Streamer[] = [];
  private readonly deciderCount = parseThreadCount(process.env.BOSS_DECIDERS, 3);
  private readonly streamCount = parseThreadCount(process.env.BOSS_STREAMS, 3);
  private nextId = 1;
  private readonly pending = new Map<number, (response: BrainResponse) => void>();
  private booting: Promise<BrainReady | null> | null = null;
  private info: BrainReady | null = null;
  private onFrame: ((roomCode: string, frame: BossFrame) => void) | null = null;

  /** Called for every live slice, with the room it belongs to. */
  subscribe(listener: (roomCode: string, frame: BossFrame) => void): void {
    this.onFrame = listener;
  }

  /** Whether the brain is online at all; the tests read it before asserting. */
  get online(): boolean {
    return this.deciders.length > 0 && this.info !== null;
  }

  /** How many rooms can have their panel live at the same time. */
  get streams(): number {
    return this.streamCount;
  }

  /**
   * Points a stream thread at a room's board, or releases the thread when the
   * room stops being watched. A room that asks while every thread is taken
   * gets nothing until one frees up; the panel shows her last decision instead.
   */
  stream(roomCode: string, on: boolean, board?: Omit<BrainIdle, 'idle' | 'on'>): void {
    if (!this.info) return;
    const current = this.streamers.find((s) => s.room === roomCode);
    if (!on) {
      if (!current) return;
      current.room = null;
      current.worker.postMessage({ idle: true, on: false } satisfies BrainIdle);
      return;
    }
    const target = current ?? this.streamers.find((s) => s.room === null);
    if (!target) return;
    target.room = roomCode;
    target.worker.postMessage({ idle: true, on: true, ...board } satisfies BrainIdle);
  }

  /** Null until the brain has loaded; she does not move until it has. */
  get ready(): BrainReady | null {
    return this.info;
  }

  onModuleInit(): void {
    // Boot in the background: nothing should wait on a connectome to serve a lobby.
    void this.start();
  }

  onModuleDestroy(): void {
    for (const { worker } of this.deciders) void worker.terminate();
    for (const { worker } of this.streamers) void worker.terminate();
    this.deciders.length = 0;
    this.streamers.length = 0;
    this.pending.clear();
  }

  /**
   * The worker is always the compiled file. A worker thread does not inherit
   * ts-jest's transform or the tsconfig path aliases, so running the `.ts`
   * source in one only ever fails on its first import; under the tests we reach
   * for the build instead, which is why `nest build` is part of the
   * verification set.
   */
  private resolveWorkerPath(): string | null {
    for (const candidate of [
      join(__dirname, 'brain.worker.js'),
      join(process.cwd(), 'dist', 'modules', 'boss', 'infrastructure', 'brain.worker.js'),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  /**
   * Starts the threads. `silenced` cuts every synapse: the control condition.
   * Resolves when the first decider is online; a stream thread that fails to
   * start is a dark panel, not a fly that will not move.
   */
  start(silenced = false): Promise<BrainReady | null> {
    if (this.booting) return this.booting;
    const file = this.resolveWorkerPath();
    if (!file) {
      this.logger.warn('Brain worker not found; the fly will not move');
      return Promise.resolve(null);
    }

    this.booting = new Promise<BrainReady | null>((resolve) => {
      let settled = false;
      let failed = 0;
      const settle = (ready: BrainReady | null): void => {
        if (ready === null) {
          failed += 1;
          if (settled || failed < this.deciderCount) return;
        }
        if (settled) return;
        settled = true;
        resolve(ready);
      };
      for (let i = 0; i < this.deciderCount; i += 1) {
        const worker = this.spawn(file, 'decide', silenced, settle);
        if (worker) this.deciders.push({ worker, inFlight: 0 });
      }
      for (let i = 0; i < this.streamCount; i += 1) {
        const worker = this.spawn(file, 'stream', silenced, null);
        if (worker) this.streamers.push({ worker, room: null });
      }
    });
    return this.booting;
  }

  /** One thread. `settle` reports a decider's boot to the pool's boot promise. */
  private spawn(
    file: string,
    role: 'decide' | 'stream',
    silenced: boolean,
    settle: ((ready: BrainReady | null) => void) | null,
  ): Worker | null {
    const options = file.endsWith('.ts')
      ? { workerData: { silenced, role }, execArgv: ['-r', 'ts-node/register'] }
      : { workerData: { silenced, role } };
    let worker: Worker;
    try {
      worker = new Worker(file, options);
    } catch (error) {
      this.logger.error(`Brain ${role} thread failed to start: ${String(error)}`);
      settle?.(null);
      return null;
    }

    worker.on('message', (message: BrainReady | BrainResponse | BossFrame) => {
      if ('biologicalMs' in message && 'cloud' in message) {
        // A live slice: the only message that carries a cloud bitset. It
        // belongs to whichever room this thread is pointed at right now.
        const room = this.streamers.find((s) => s.worker === worker)?.room;
        if (room) this.onFrame?.(room, message);
        return;
      }
      if ('ready' in message) {
        if (role === 'decide' && !this.info) this.info = message;
        this.logger.log(
          `Brain ${role} thread online: ${message.neurons.toLocaleString()} neurons, ` +
            `${message.edges.toLocaleString()} synapses, loaded in ${message.loadMs} ms` +
            (silenced ? ' [SILENCED: control condition]' : ''),
        );
        settle?.(message);
        return;
      }
      const decider = this.deciders.find((d) => d.worker === worker);
      if (decider) decider.inFlight = Math.max(0, decider.inFlight - 1);
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        pending(message);
      }
    });
    worker.on('error', (error: unknown) => {
      this.logger.error(
        `Brain ${role} thread died: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (role === 'stream') {
        const at = this.streamers.findIndex((s) => s.worker === worker);
        if (at >= 0) this.streamers.splice(at, 1);
        return;
      }
      const at = this.deciders.findIndex((d) => d.worker === worker);
      if (at >= 0) this.deciders.splice(at, 1);
      if (this.deciders.length > 0) return;
      // The last decider is gone: nothing can answer, so nothing should wait.
      this.info = null;
      for (const pending of this.pending.values()) {
        pending({
          id: -1,
          rates: [],
          biologicalMs: 0,
          wallMs: 0,
          spikes: 0,
          telemetry: EMPTY_TELEMETRY,
        });
      }
      this.pending.clear();
      settle?.(null);
    });
    worker.unref();
    return worker;
  }

  /**
   * Shows her a board and reads what her descending cells did, on the decider
   * with the fewest questions waiting.
   *
   * A decision is 960 biological ms and about seven seconds of wall time, more
   * on a loaded machine. The old 8 s limit left no margin: a late answer was
   * discarded, the turn retried, and each retry queued another seven seconds
   * behind the one still running.
   */
  ask(request: Omit<BrainRequest, 'id'>, timeoutMs = 30000): Promise<BrainResponse | null> {
    if (!this.info || this.deciders.length === 0) return Promise.resolve(null);
    const decider = this.deciders.reduce((best, d) => (d.inFlight < best.inFlight ? d : best));
    const id = this.nextId;
    this.nextId += 1;

    return new Promise<BrainResponse | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.logger.warn(`Brain did not answer within ${timeoutMs} ms`);
        resolve(null);
      }, timeoutMs);
      timer.unref();

      this.pending.set(id, (response) => {
        clearTimeout(timer);
        resolve(response.id === id ? response : null);
      });
      decider.inFlight += 1;
      decider.worker.postMessage({ ...request, id } satisfies BrainRequest);
    });
  }
}
