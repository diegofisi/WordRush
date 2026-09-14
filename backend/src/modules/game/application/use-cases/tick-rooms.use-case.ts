import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { RoundLifecycleService } from '../services/round-lifecycle.service';

/** One pass of the game loop over every room that is playing. */
@Injectable()
export class TickRoomsUseCase {
  private readonly logger = new Logger(TickRoomsUseCase.name);
  /**
   * Codes whose last tick threw, cleared as soon as one succeeds. A room that
   * fails deterministically would otherwise be reported four times a second
   * for as long as it exists.
   */
  private readonly failing = new Set<string>();

  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  execute(now: number): void {
    for (const room of this.rooms.all()) {
      if (room.status !== 'playing') continue;
      // The guard is per room, not around the loop. A room whose state makes
      // the lifecycle throw would otherwise abort the whole pass, and since the
      // repository iterates in insertion order, every room created after it
      // would stop being ticked on this and every following tick: clocks never
      // running out, rounds never ending, and only a log line to show for it.
      try {
        this.lifecycle.finishTimedOut(room, now);
        this.lifecycle.endRoundIfOver(room, now);
        this.failing.delete(room.code);
      } catch (error: unknown) {
        if (this.failing.has(room.code)) continue;
        this.failing.add(room.code);
        this.logger.error(
          `Tick failed for room ${room.code}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }
}
