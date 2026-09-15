import { Inject, Injectable } from '@nestjs/common';
import { attemptsFor, SCORING, type GuessAck } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { IWordList, WORD_LIST } from '@modules/words/domain/interfaces/word-list.interface';
import { isWordShaped, normalizeWord } from '@modules/words/domain/services/normalize-word';
import { computeFeedback } from '../../domain/services/color-feedback';
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
    private readonly bus: RoomEventsBus,
    private readonly lifecycle: RoundLifecycleService,
  ) {}

  execute(roomCode: string, playerId: string, rawWord: string): GuessAck {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');
    const round = player.round;
    const answer = room.word;
    if (room.status !== 'playing' || !round || !answer) throw new DomainException('not_in_round');
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
    if (solved) this.announceSolve(room, player, now);
    else if (team) this.lifecycle.publishTeamClocks(room, now);
    this.lifecycle.endRoundIfOver(room, now);
    return ack;
  }

  /** `player:solved`, then -5 s to everyone still playing, then `time:penalty`. */
  private announceSolve(room: Room, solver: Player, now: number): void {
    const solverRound = solver.round;
    if (!solverRound) return;
    this.bus.publish({
      roomCode: room.code,
      event: 'player:solved',
      payload: {
        playerId: solver.id,
        position: solverRound.solvedPosition ?? room.solvedCount,
        attempt: solverRound.attempt,
        secondsLeft: solverRound.secondsLeft(now),
      },
    });

    const penalty = SCORING.penaltyOnRivalSolveSeconds;
    const clocks: { playerId: string; secondsLeft: number; at: number }[] = [];
    if (room.teams.length > 0) {
      // One hit on the rival team's clock, reported for each of its members.
      for (const team of room.teams) {
        if (team.id === solver.team || !team.round || team.round.finished) continue;
        team.round.applyPenalty(penalty);
        for (const rival of room.members(team.id)) {
          clocks.push({ playerId: rival.id, secondsLeft: team.round.secondsLeft(now), at: now });
        }
      }
    } else {
      for (const rival of room.players) {
        const r = rival.round;
        if (rival.id === solver.id || !r || r.solved || r.finished) continue;
        r.applyPenalty(penalty);
        clocks.push({ playerId: rival.id, secondsLeft: r.secondsLeft(now), at: now });
      }
    }
    this.bus.publish({
      roomCode: room.code,
      event: 'time:penalty',
      payload: { fromPlayerId: solver.id, seconds: penalty, clocks },
    });
    this.lifecycle.publishTeamClocks(room, now);
    // A penalty can push a clock past its deadline: settle those right away.
    this.lifecycle.finishTimedOut(room, now);
  }
}
