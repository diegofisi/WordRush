import { Inject, Injectable } from '@nestjs/common';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { RoundLifecycleService } from '../services/round-lifecycle.service';

/** One pass of the game loop over every room that is playing. */
@Injectable()
export class TickRoomsUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  execute(now: number): void {
    for (const room of this.rooms.all()) {
      if (room.status !== 'playing') continue;
      this.lifecycle.finishTimedOut(room, now);
      this.lifecycle.endRoundIfOver(room, now);
    }
  }
}
