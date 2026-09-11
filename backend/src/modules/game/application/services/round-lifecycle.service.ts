import { Injectable } from '@nestjs/common';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { toPlayerProgress } from '@modules/rooms/domain/services/state-presenter';
import { EndRoundUseCase } from '../use-cases/end-round.use-case';

/**
 * Shared round bookkeeping used by guesses, hints and the ticker: finishing
 * players whose clock ran out and closing the round when everyone is done.
 */
@Injectable()
export class RoundLifecycleService {
  constructor(
    private readonly bus: RoomEventsBus,
    private readonly endRound: EndRoundUseCase,
  ) {}

  /** Marks every player whose deadline passed as finished (time out) and broadcasts it. */
  finishTimedOut(room: Room, now: number): Player[] {
    const timedOut: Player[] = [];
    for (const player of room.players) {
      const round = player.round;
      if (round && round.isOutOfTime(now)) {
        round.finish('timeout', now);
        timedOut.push(player);
      }
    }
    for (const player of timedOut) this.publishProgress(room, player, now);
    return timedOut;
  }

  publishProgress(room: Room, player: Player, now: number): void {
    this.bus.publish({
      roomCode: room.code,
      event: 'player:progress',
      payload: toPlayerProgress(player, now),
    });
  }

  isRoundOver(room: Room): boolean {
    return room.players.length > 0 && room.players.every((p) => p.round?.finished === true);
  }

  /** Ends the round if the room is playing and nobody is left in it. */
  endRoundIfOver(room: Room, now: number): boolean {
    if (room.status !== 'playing' || !this.isRoundOver(room)) return false;
    this.endRound.execute(room, now);
    return true;
  }
}
