import { Inject, Injectable } from '@nestjs/common';
import { attemptsFor, PHRASE_RULES, type GuessAck } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { toSelfState } from '@modules/rooms/domain/services/state-presenter';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { IWordList, WORD_LIST } from '@modules/words/domain/interfaces/word-list.interface';
import { isWordShaped, normalizeWord } from '@modules/words/domain/services/normalize-word';
import { computeFeedback } from '../../domain/services/color-feedback';
import { checkWord, occurrences } from '../../domain/services/phrase';
import { chargeGuess, totalSeconds } from '../../domain/services/time-ledger';
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
    if (room.status !== 'playing' || !round) throw new DomainException('not_in_round');
    if (round.finished || round.team?.finished) throw new DomainException('already_finished');

    const now = this.clock.now();
    if (round.isOutOfTime(now)) {
      // The ticker has not caught it yet; settle it here so the client learns immediately.
      this.lifecycle.finishTimedOut(room, now);
      this.lifecycle.endRoundIfOver(room, now);
      throw new DomainException('already_finished');
    }

    const word = normalizeWord(rawWord);
    if (!isWordShaped(word, room.settings.wordLength)) throw new DomainException('word_length');
    if (!this.wordList.isAllowed(room.settings.language, word)) {
      throw new DomainException('word_not_in_list');
    }

    if (room.settings.game === 'phrase') return this.typePhraseWord(room, player, word, now);

    const answer = room.word;
    if (!answer) throw new DomainException('not_in_round');
    const feedback = computeFeedback(word, answer);
    const gains = chargeGuess(round.charges, word, feedback);
    const secondsGained = totalSeconds(gains);
    round.addSeconds(secondsGained);
    round.rows.push({ word, colors: feedback.colors });
    room.touch(now);

    const team = round.team;
    // Team mode: every member's words after their first cost the team.
    if (team && round.attempt > 1) team.attemptsAfterFirst += 1;

    const solved = word === answer;
    if (solved) {
      room.solvedCount += 1;
      round.markSolved(room.solvedCount, now);
      if (team) {
        // The team solved: its clock freezes and every teammate stops.
        team.markSolved(room.solvedCount, player.id, now);
        for (const mate of room.players) {
          if (mate.team === player.team && mate.id !== player.id) mate.round?.finish('team', now);
        }
      }
    } else if (round.attempt >= attemptsFor(room.settings.wordLength)) {
      round.finish('attempts', now);
      this.lifecycle.closeTeamIfSpent(room, player, now);
    }

    const ack: GuessAck = {
      colors: [...feedback.colors],
      gains,
      secondsGained,
      secondsLeft: round.secondsLeft(now),
      at: now,
      attempt: round.attempt,
      solved,
      finished: round.finished,
      solvedPosition: round.solvedPosition,
      phrase: null,
    };

    this.lifecycle.publishProgress(room, player, now);
    this.lifecycle.publishTeammateRows(room, player);
    if (team && solved) {
      for (const mate of room.players) {
        if (mate.team === player.team && mate.id !== player.id) {
          this.lifecycle.publishProgress(room, mate, now);
        }
      }
    }
    if (solved) this.lifecycle.announceSolve(room, player, now);
    else if (team) this.lifecycle.publishTeamClocks(room, now);
    this.lifecycle.endRoundIfOver(room, now);
    return ack;
  }

  /**
   * Phrase game (docs/context/06-v1.1.md -> Guess the phrase): every letter of
   * the word that is anywhere in the phrase turns green and reveals all its
   * occurrences, 2 s each; the rest is grey. Six words a round, and running
   * out of them ends nothing — only the phrase, the sends or the clock do.
   */
  private typePhraseWord(room: Room, player: Player, word: string, now: number): GuessAck {
    const round = player.round;
    const phrase = room.phrase;
    const progress = round?.phrase;
    if (!round || !phrase || !progress) throw new DomainException('not_in_round');
    if (round.attempt >= PHRASE_RULES.words) throw new DomainException('already_finished');

    const { colors, newLetters } = checkWord(phrase, word, progress.found);
    const gains = newLetters.map((letter) => ({
      letter,
      position: word.indexOf(letter),
      kind: 'green' as const,
      seconds: PHRASE_RULES.secondsPerOccurrence * occurrences(phrase, letter),
    }));
    progress.reveal(newLetters);
    progress.wordsSent += 1;
    const secondsGained = gains.reduce((sum, gain) => sum + gain.seconds, 0);
    round.addSeconds(secondsGained);
    round.rows.push({ word, colors });
    room.touch(now);

    const ack: GuessAck = {
      colors,
      gains,
      secondsGained,
      secondsLeft: round.secondsLeft(now),
      at: now,
      attempt: round.attempt,
      solved: false,
      finished: false,
      solvedPosition: null,
      phrase: toSelfState(player, now, phrase).phrase,
    };
    this.lifecycle.publishProgress(room, player, now);
    this.lifecycle.publishTeammateRows(room, player);
    if (round.team) {
      // Teammates share the phrase: their view moved too.
      for (const mate of room.players) {
        if (mate.team === player.team && mate.id !== player.id) {
          this.lifecycle.publishProgress(room, mate, now);
        }
      }
      this.lifecycle.publishTeamClocks(room, now);
    }
    return ack;
  }
}
