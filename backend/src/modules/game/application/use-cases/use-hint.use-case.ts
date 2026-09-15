import { Inject, Injectable } from '@nestjs/common';
import type { HintAck } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { pickHint } from '../../domain/services/hint-picker';
import { RoundLifecycleService } from '../services/round-lifecycle.service';

/**
 * One hint per player per round (docs/context/06-v1.1.md -> Hint): a new letter
 * while any slot is unknown, the placement of a known one once none is. The
 * room is told a hint was spent, never by whom.
 */
@Injectable()
export class UseHintUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  execute(roomCode: string, playerId: string): HintAck {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');
    const round = player.round;
    if (room.status !== 'playing' || !round) throw new DomainException('not_in_round');
    // No hint in the phrase game: every green already reveals a letter.
    if (!room.settings.hintEnabled || room.settings.game === 'phrase') {
      throw new DomainException('hint_unavailable');
    }
    const answer = room.word;
    if (!answer) throw new DomainException('not_in_round');
    if (round.finished || round.team?.finished) throw new DomainException('already_finished');
    // One per player, or one per team: `hintUsed` reads the team's in team mode.
    if (round.hintUsed) throw new DomainException('hint_already_used');

    const now = this.clock.now();
    if (round.isOutOfTime(now)) {
      this.lifecycle.finishTimedOut(room, now);
      this.lifecycle.endRoundIfOver(room, now);
      throw new DomainException('already_finished');
    }

    const pick = pickHint(answer, round.charges);
    if (!pick) throw new DomainException('hint_unavailable');
    round.revealHint(pick);
    room.touch(now);

    const usedInRound =
      room.teams.length > 0
        ? room.teams.filter((t) => t.round?.hintUsed).length
        : room.players.filter((p) => p.round?.hintUsed).length;
    this.bus.publish({ roomCode: room.code, event: 'player:hint', payload: { usedInRound } });
    // Team mode: the reveal is the team's; every member's board and keyboard show it.
    if (player.team !== null && round.hint) {
      for (const mate of room.members(player.team)) {
        if (mate.id === player.id || !mate.connected) continue;
        this.bus.publish({
          roomCode: room.code,
          toPlayerId: mate.id,
          event: 'team:hint',
          payload: round.hint,
        });
      }
    }
    return {
      letter: pick.letter,
      kind: pick.kind,
      position: pick.kind === 'position' ? pick.position : null,
      secondsLeft: round.secondsLeft(now),
      at: now,
    };
  }
}
