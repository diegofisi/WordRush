import { Injectable, OnModuleDestroy } from '@nestjs/common';

/**
 * Owns the one-shot timers between rounds, keyed by room code, so they can
 * be replaced or cleared (room deleted, app shutting down).
 */
@Injectable()
export class RoundSchedulerService implements OnModuleDestroy {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  schedule(roomCode: string, delayMs: number, callback: () => void): void {
    this.cancel(roomCode);
    const timer = setTimeout(() => {
      this.timers.delete(roomCode);
      callback();
    }, delayMs);
    timer.unref();
    this.timers.set(roomCode, timer);
  }

  cancel(roomCode: string): void {
    const timer = this.timers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.timers.delete(roomCode);
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
