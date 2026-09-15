import { Inject, Injectable } from '@nestjs/common';
import { PHRASE_RULES, type PhraseAck } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { checkPhrase } from '../../domain/services/phrase';
import { RoundLifecycleService } from '../services/round-lifecycle.service';

/**
 * One try at the whole phrase (docs/context/06-v1.1.md -> Guess the phrase):
 * a hit completes the round for the player (or the team) and hits the rivals'
 * clocks like a Wordle solve; a miss spends one of the five sends and, on the
 * last one, ends the round for them. Running out of words never ends it.
 */
@Injectable()
export class SubmitPhraseUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  execute(roomCode: string, playerId: string, text: string): PhraseAck {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');
    const round = player.round;
    const phrase = room.phrase;
    const progress = round?.phrase;
    if (room.status !== 'playing' || !round || !phrase || !progress) {
      throw new DomainException('not_in_round');
    }
    if (round.finished || round.team?.finished) throw new DomainException('already_finished');

    const now = this.clock.now();
    if (round.isOutOfTime(now)) {
      this.lifecycle.finishTimedOut(room, now);
      this.lifecycle.endRoundIfOver(room, now);
      throw new DomainException('already_finished');
    }
    if (progress.sendsUsed >= PHRASE_RULES.sends) throw new DomainException('no_sends_left');

    const check = checkPhrase(phrase, text);
    if (!check.fits) throw new DomainException('phrase_shape');

    const team = round.team;
    if (check.correct) {
      progress.completed = true;
      progress.reveal(phrase.words.join('').split(''));
      room.solvedCount += 1;
      round.markSolved(room.solvedCount, now);
      if (team) {
        team.markSolved(room.solvedCount, player.id, now);
        for (const mate of room.players) {
          if (mate.team === player.team && mate.id !== player.id) mate.round?.finish('team', now);
        }
      }
    } else {
      progress.sendsUsed += 1;
      if (progress.sendsUsed >= PHRASE_RULES.sends) {
        if (team) {
          team.finish('attempts', now);
          for (const mate of room.players) {
            if (mate.team === player.team) mate.round?.finish('team', now);
          }
        } else {
          round.finish('attempts', now);
        }
      }
    }
    room.touch(now);

    const ack: PhraseAck = {
      correct: check.correct,
      sendsUsed: progress.sendsUsed,
      wrong: check.correct ? null : check.wrong,
      secondsLeft: round.secondsLeft(now),
      at: now,
      finished: round.finished,
      solvedPosition: round.solvedPosition,
    };

    this.bus.publish({
      roomCode: room.code,
      event: 'phrase:attempt',
      payload: { playerId: player.id, correct: check.correct },
    });
    this.lifecycle.publishProgress(room, player, now);
    if (team) {
      for (const mate of room.players) {
        if (mate.team === player.team && mate.id !== player.id) {
          this.lifecycle.publishProgress(room, mate, now);
        }
      }
    }
    if (check.correct) this.lifecycle.announceSolve(room, player, now);
    else this.lifecycle.publishTeamClocks(room, now);
    this.lifecycle.endRoundIfOver(room, now);
    return ack;
  }
}
