import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/domain/clock';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { RoundLifecycleService } from '../services/round-lifecycle.service';

/**
 * Closes the current round straight away when nobody is left to play it —
 * used after somebody leaves the room, so the others do not wait 250 ms for
 * the next tick (or, worse, for a clock that nobody is watching).
 */
@Injectable()
export class SettleRoundUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  execute(roomCode: string): void {
    const room = this.rooms.findByCode(roomCode);
    if (!room || room.status !== 'playing') return;
    const now = this.clock.now();
    this.lifecycle.closeSpentTeams(room, now);
    this.lifecycle.finishTimedOut(room, now);
    this.lifecycle.endRoundIfOver(room, now);
  }
}
