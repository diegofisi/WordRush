import { Injectable } from '@nestjs/common';
import { BOSS, SCORING } from '@shared/contract';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { toPlayerProgress } from '@modules/rooms/domain/services/state-presenter';
import type { IRoundBookkeeping } from '../../domain/interfaces/round-bookkeeping.interface';
import { EndRoundUseCase } from '../use-cases/end-round.use-case';

/**
 * Shared round bookkeeping used by guesses, hints and the ticker: finishing
 * players whose clock ran out and closing the round when everyone is done.
 */
@Injectable()
export class RoundLifecycleService implements IRoundBookkeeping {
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

  /**
   * `player:solved`, then the time hit, then `time:penalty`.
   *
   * Normally the hit lands on every rival who has not solved. In boss mode the
   * humans are a team: a human solve damages only the fly, and only the fly
   * damages humans. Same mechanic, different target (docs/context/06-boss-mode.md).
   */
  announceSolve(room: Room, solver: Player, now: number): void {
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

    const boss = room.settings.bossMode;
    const penalty =
      boss && !solver.isBot ? BOSS.damageOnHumanSolve : SCORING.penaltyOnRivalSolveSeconds;

    const clocks: { playerId: string; secondsLeft: number; at: number }[] = [];
    for (const rival of room.players) {
      const round = rival.round;
      if (rival.id === solver.id || !round || round.solved || round.finished) continue;
      // Nobody hits their own side.
      if (boss && rival.isBot === solver.isBot) continue;
      round.applyPenalty(penalty);
      clocks.push({ playerId: rival.id, secondsLeft: round.secondsLeft(now), at: now });
    }

    this.bus.publish({
      roomCode: room.code,
      event: 'time:penalty',
      payload: { fromPlayerId: solver.id, seconds: penalty, clocks },
    });

    // A hit can push a clock past its deadline: settle those right away.
    this.finishTimedOut(room, now);
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
