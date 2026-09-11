import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { TickRoomsUseCase } from '../use-cases/tick-rooms.use-case';

export const TICK_INTERVAL_MS = 250;

/** The only timer of the game loop: drives clocks running out and round ends. */
@Injectable()
export class RoomTickerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomTickerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly tickRooms: TickRoomsUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(): void {
    try {
      this.tickRooms.execute(this.clock.now());
    } catch (error: unknown) {
      this.logger.error('Tick failed', error instanceof Error ? error.stack : error);
    }
  }
}
