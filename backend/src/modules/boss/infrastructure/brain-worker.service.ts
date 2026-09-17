import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { BossFrame } from '@shared/contract';
import { parseThreadCount } from '../domain/services/boss-env';
import type { BrainIdle, BrainReady, BrainRequest, BrainResponse } from './brain.worker';

/**
 * Owns the worker threads the brain runs on, and turns their messages into
 * promises.
 *
 * Two pools that grow with demand and shrink when it goes, each thread with
 * its own copy of the connectome (~90 MB):
 *
 *   deciders  answer the fly's turns. One is always warm, because the first
 *             turn of a round should not wait for a connectome to load. When
 *             a question arrives and every decider already has one in flight,
 *             another thread boots (up to `BOSS_DECIDERS`); a request goes to
 *             the thread with the fewest in flight. One decision is about
 *             seven seconds of a core, and one thread serving every room in a
 *             queue halved her pace with two rooms.
 *   streamers feed the brain panel, one watched room each. None runs until
 *             somebody opens a panel; a second room watching boots a second
 *             thread (up to `BOSS_STREAMS`).
 *
 * A thread with nothing to do for `IDLE_MS` is terminated, except the warm
 * decider. Sized for three simultaneous boss rooms with two being the usual
 * case (2026-09-15). More threads than cores buys nothing: on one vCPU three
 * decisions take three times as long, they just all finish inside the timeout.
 */
interface Decider {
  worker: Worker;
  ready: boolean;
  inFlight: number;
  /** Epoch ms since it last had nothing in flight. */
  idleSince: number;
}

interface Streamer {
  worker: Worker;
  ready: boolean;
  /** The room whose board this thread is streaming; null while idle. */
  room: string | null;
  idleSince: number;
}

const IDLE_MS = 60_000;
const REAP_EVERY_MS = 10_000;

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
  private readonly deciderMax = parseThreadCount(process.env.BOSS_DECIDERS, 3);
  private readonly streamMax = parseThreadCount(process.env.BOSS_STREAMS, 3);
  private file: string | null = null;
  private silenced = false;
  private reaper: NodeJS.Timeout | null = null;
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
    return this.info !== null && this.deciders.some((d) => d.ready);
  }

  /** How many rooms can have their panel live at the same time. */
  get streams(): number {
    return this.streamMax;
  }

  /** Threads alive right now, for the log and the tests. */
  get threads(): { deciders: number; streamers: number } {
    return { deciders: this.deciders.length, streamers: this.streamers.length };
  }

  /**
   * Points a stream thread at a room's board, or releases the thread when the
   * room stops being watched. The ticker calls this every tick for every
   * watched room, so a thread that is still booting is simply found ready on
   * a later call; a room past the thread count gets nothing until one frees.
   */
  stream(roomCode: string, on: boolean, board?: Omit<BrainIdle, 'idle' | 'on'>): void {
    if (!this.info) return;
    const current = this.streamers.find((s) => s.room === roomCode);
    if (!on) {
      if (!current) return;
      current.room = null;
      current.idleSince = Date.now();
      current.worker.postMessage({ idle: true, on: false } satisfies BrainIdle);
      return;
    }
    const target = current ?? this.streamers.find((s) => s.ready && s.room === null);
    if (!target) {
      if (this.streamers.length < this.streamMax && !this.streamers.some((s) => !s.ready)) {
        this.spawnStreamer();
      }
      return;
    }
    target.room = roomCode;
    target.worker.postMessage({ idle: true, on: true, ...board } satisfies BrainIdle);
  }

  /** Null until the brain has loaded; she does not move until it has. */
  get ready(): BrainReady | null {
    return this.info;
  }

  onModuleInit(): void {
    // Nothing boots here. A thread holds ~90 MB of connectome, so the brain is
    // only woken when a room is actually playing against her: the ticker calls
    // `ensure()` and she stands still (retrying every 1.5 s) until it answers.
  }

  /** Boots the warm decider if it is not up yet. Idempotent and cheap to call. */
  ensure(): void {
    void this.start();
  }

  onModuleDestroy(): void {
    if (this.reaper) clearInterval(this.reaper);
    this.reaper = null;
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
   * Boots the warm decider. `silenced` cuts every synapse: the control
   * condition, and it applies to every thread spawned later too.
   */
  start(silenced = false): Promise<BrainReady | null> {
    if (this.booting) return this.booting;
    this.file = this.resolveWorkerPath();
    this.silenced = silenced;
    if (!this.file) {
      this.logger.warn('Brain worker not found; the fly will not move');
      return Promise.resolve(null);
    }

    this.booting = new Promise<BrainReady | null>((resolve) => {
      if (!this.spawnDecider(resolve)) resolve(null);
    });
    this.reaper = setInterval(() => this.reap(), REAP_EVERY_MS);
    this.reaper.unref();
    return this.booting;
  }

  /** Terminates threads that have had nothing to do for a while, keeping one decider. */
  private reap(): void {
    const now = Date.now();
    for (let i = this.deciders.length - 1; i >= 1; i -= 1) {
      const d = this.deciders[i];
      if (d && d.ready && d.inFlight === 0 && now - d.idleSince > IDLE_MS) {
        this.deciders.splice(i, 1);
        void d.worker.terminate();
        this.logger.log(`Brain decide thread released after ${IDLE_MS / 1000} s idle`);
      }
    }
    for (let i = this.streamers.length - 1; i >= 0; i -= 1) {
      const s = this.streamers[i];
      if (s && s.ready && s.room === null && now - s.idleSince > IDLE_MS) {
        this.streamers.splice(i, 1);
        void s.worker.terminate();
        this.logger.log(`Brain stream thread released after ${IDLE_MS / 1000} s idle`);
      }
    }
  }

  private spawnDecider(settle: ((ready: BrainReady | null) => void) | null): boolean {
    if (!this.file) return false;
    const worker = this.spawn(this.file, 'decide', settle);
    if (!worker) return false;
    this.deciders.push({ worker, ready: false, inFlight: 0, idleSince: Date.now() });
    return true;
  }

  private spawnStreamer(): void {
    if (!this.file) return;
    const worker = this.spawn(this.file, 'stream', null);
    if (worker) this.streamers.push({ worker, ready: false, room: null, idleSince: Date.now() });
  }

  /** One thread. `settle` reports a decider's boot to the boot promise. */
  private spawn(
    file: string,
    role: 'decide' | 'stream',
    settle: ((ready: BrainReady | null) => void) | null,
  ): Worker | null {
    const silenced = this.silenced;
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
        if (role === 'decide') {
          const decider = this.deciders.find((d) => d.worker === worker);
          if (decider) decider.ready = true;
          if (!this.info) this.info = message;
        } else {
          const streamer = this.streamers.find((s) => s.worker === worker);
          if (streamer) {
            streamer.ready = true;
            streamer.idleSince = Date.now();
          }
        }
        this.logger.log(
          `Brain ${role} thread online (${this.deciders.length} deciding, ` +
            `${this.streamers.length} streaming): ${message.neurons.toLocaleString()} neurons, ` +
            `${message.edges.toLocaleString()} synapses, loaded in ${message.loadMs} ms` +
            (silenced ? ' [SILENCED: control condition]' : ''),
        );
        settle?.(message);
        return;
      }
      const decider = this.deciders.find((d) => d.worker === worker);
      if (decider) {
        decider.inFlight = Math.max(0, decider.inFlight - 1);
        if (decider.inFlight === 0) decider.idleSince = Date.now();
      }
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
   * Shows her a board and reads what her descending cells did, on the ready
   * decider with the fewest questions waiting. If every one of them is busy
   * and there is room for another, one starts booting for the next question.
   *
   * A decision is 960 biological ms and about seven seconds of wall time, more
   * on a loaded machine. The old 8 s limit left no margin: a late answer was
   * discarded, the turn retried, and each retry queued another seven seconds
   * behind the one still running.
   */
  ask(request: Omit<BrainRequest, 'id'>, timeoutMs = 30000): Promise<BrainResponse | null> {
    const ready = this.deciders.filter((d) => d.ready);
    if (!this.info || ready.length === 0) return Promise.resolve(null);
    const decider = ready.reduce((best, d) => (d.inFlight < best.inFlight ? d : best));
    if (
      decider.inFlight > 0 &&
      this.deciders.length < this.deciderMax &&
      !this.deciders.some((d) => !d.ready)
    ) {
      this.spawnDecider(null);
    }
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
