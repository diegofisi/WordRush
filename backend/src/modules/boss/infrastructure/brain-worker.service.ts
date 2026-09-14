import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { BossFrame } from '@shared/contract';
import type { BrainIdle, BrainReady, BrainRequest, BrainResponse } from './brain.worker';

/**
 * Owns the worker thread the brain runs on, and turns its messages into
 * promises. One question at a time: the fly takes a single decision per turn
 * and queueing keeps the thread's memory footprint to one simulation.
 */
@Injectable()
export class BrainWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrainWorkerService.name);
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, (response: BrainResponse) => void>();
  private booting: Promise<BrainReady | null> | null = null;
  private info: BrainReady | null = null;
  private onFrame: ((frame: BossFrame) => void) | null = null;

  /** Called for every live slice while the stream is on. */
  subscribe(listener: (frame: BossFrame) => void): void {
    this.onFrame = listener;
  }

  /** Whether the brain is online at all; the tests read it before asserting. */
  get online(): boolean {
    return this.worker !== null && this.info !== null;
  }

  /** Turns the live stream on or off, optionally pointing it at a board. */
  stream(on: boolean, board?: Omit<BrainIdle, 'idle' | 'on'>): void {
    if (!this.worker || !this.info) return;
    this.worker.postMessage({ idle: true, on, ...board } satisfies BrainIdle);
  }

  /** Null until the brain has loaded; the fly falls back to her policy until then. */
  get ready(): BrainReady | null {
    return this.info;
  }

  onModuleInit(): void {
    // Boot in the background: nothing should wait on a connectome to serve a lobby.
    void this.start();
  }

  onModuleDestroy(): void {
    void this.worker?.terminate();
    this.worker = null;
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

  /** Starts the thread. `silenced` cuts every synapse: the control condition. */
  start(silenced = false): Promise<BrainReady | null> {
    if (this.booting) return this.booting;
    const file = this.resolveWorkerPath();
    if (!file) {
      this.logger.warn('Brain worker not found; the fly will use her fallback policy');
      return Promise.resolve(null);
    }

    this.booting = new Promise<BrainReady | null>((resolve) => {
      const options = file.endsWith('.ts')
        ? { workerData: { silenced }, execArgv: ['-r', 'ts-node/register'] }
        : { workerData: { silenced } };
      let worker: Worker;
      try {
        worker = new Worker(file, options);
      } catch (error) {
        this.logger.error(`Brain worker failed to start: ${String(error)}`);
        resolve(null);
        return;
      }
      this.worker = worker;

      worker.on('message', (message: BrainReady | BrainResponse | BossFrame) => {
        if ('biologicalMs' in message && 'cloud' in message) {
          // A live slice: the only message that carries a cloud bitset.
          this.onFrame?.(message);
          return;
        }
        if ('ready' in message) {
          this.info = message;
          this.logger.log(
            `Brain online: ${message.neurons.toLocaleString()} neurons, ` +
              `${message.edges.toLocaleString()} synapses, loaded in ${message.loadMs} ms` +
              (silenced ? ' [SILENCED: control condition]' : ''),
          );
          resolve(message);
          return;
        }
        const settle = this.pending.get(message.id);
        if (settle) {
          this.pending.delete(message.id);
          settle(message);
        }
      });
      worker.on('error', (error: unknown) => {
        this.logger.error(
          `Brain worker died: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.info = null;
        this.worker = null;
        for (const settle of this.pending.values()) {
          settle({
            id: -1,
            rates: [],
            biologicalMs: 0,
            wallMs: 0,
            spikes: 0,
            telemetry: {
              raster: [],
              voltage: [],
              populations: [],
              excitatory: 0,
              inhibitory: 0,
              cloud: [],
              stimulus: [],
            },
          });
        }
        this.pending.clear();
        resolve(null);
      });
      worker.unref();
    });
    return this.booting;
  }

  /** Shows her a board and reads what her descending cells did. */
  ask(request: Omit<BrainRequest, 'id'>, timeoutMs = 8000): Promise<BrainResponse | null> {
    const worker = this.worker;
    if (!worker || !this.info) return Promise.resolve(null);
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
      worker.postMessage({ ...request, id } satisfies BrainRequest);
    });
  }
}
