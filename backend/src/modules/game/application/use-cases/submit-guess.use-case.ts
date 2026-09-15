import { Inject, Injectable } from '@nestjs/common';
import { MAX_ATTEMPTS, WORD_LENGTH, type GuessAck } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { IWordList, WORD_LIST } from '@modules/words/domain/interfaces/word-list.interface';
import { isWordShaped, normalizeWord } from '@modules/words/domain/services/normalize-word';
import { applyGuessRow } from '../../domain/services/apply-guess';
import { RoundLifecycleService } from '../services/round-lifecycle.service';

/**
 * Processes one guess. Everything here is synchronous so two near-simultaneous
 * solves are ordered by arrival: the first one to run is "first", freezes its
 * clock and penalises the rest before the second one is even looked at.
 */
@Injectable()
export class SubmitGuessUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(WORD_LIST) private readonly wordList: IWordList,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  execute(roomCode: string, playerId: string, rawWord: string): GuessAck {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');
    const round = player.round;
    const answer = room.word;
    if (room.status !== 'playing' || !round || !answer) throw new DomainException('not_in_round');
    if (round.finished) throw new DomainException('already_finished');

    const now = this.clock.now();
    if (round.isOutOfTime(now)) {
      // The ticker has not caught it yet; settle it here so the client learns immediately.
      this.lifecycle.finishTimedOut(room, now);
      this.lifecycle.endRoundIfOver(room, now);
      throw new DomainException('already_finished');
    }

    const word = normalizeWord(rawWord);
    if (!isWordShaped(word, WORD_LENGTH)) throw new DomainException('word_length');
    if (!this.wordList.isAllowed(room.settings.language, word)) {
      throw new DomainException('word_not_in_list');
    }

    const { colors, gains, secondsGained } = applyGuessRow(round, word, answer, true);
    room.touch(now);

    const solved = word === answer;
    if (solved) {
      room.solvedCount += 1;
      round.markSolved(room.solvedCount, now);
    } else if (round.attempt >= MAX_ATTEMPTS) {
      round.finish('attempts', now);
    }

    const ack: GuessAck = {
      colors: [...colors],
      gains,
      secondsGained,
      secondsLeft: round.secondsLeft(now),
      at: now,
      attempt: round.attempt,
      solved,
      finished: round.finished,
      solvedPosition: round.solvedPosition,
    };

    this.lifecycle.publishProgress(room, player, now);
    if (solved) this.lifecycle.announceSolve(room, player, now);
    this.lifecycle.endRoundIfOver(room, now);
    return ack;
  }
}
