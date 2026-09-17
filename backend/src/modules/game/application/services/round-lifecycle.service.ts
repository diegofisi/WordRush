import { Injectable } from '@nestjs/common';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md): BOSS only.
import { BOSS, SCORING } from '@shared/contract';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import {
  toPlayerProgress,
  toTeammateRows,
  toTeamRoundState,
} from '@modules/rooms/domain/services/state-presenter';
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

  /**
   * Marks every player whose deadline passed as finished (time out) and
   * broadcasts it. In team mode the deadline is the team's: the team round
   * closes and every member with it.
   */
  finishTimedOut(room: Room, now: number): Player[] {
    const timedOut: Player[] = [];
    // Members first: a member's deadline is the team's, and once the team round
    // is closed it no longer reads as "out of time", so the order matters.
    for (const player of room.players) {
      const round = player.round;
      if (round && round.isOutOfTime(now)) {
        round.finish('timeout', now);
        timedOut.push(player);
      }
    }
    for (const team of room.teams) {
      if (team.round?.isOutOfTime(now)) team.round.finish('timeout', now);
    }
    for (const player of timedOut) this.publishProgress(room, player, now);
    if (timedOut.length > 0) this.publishTeamClocks(room, now);
    return timedOut;
  }

  /**
   * Team mode: a team whose remaining members are all done (out of attempts,
   * or gone) is closed, so the round does not wait for its clock. Used after
   * somebody leaves or is kicked mid-round.
   */
  closeSpentTeams(room: Room, now: number): boolean {
    let closed = false;
    for (const team of room.teams) {
      if (!team.round || team.round.finished) continue;
      const members = room.members(team.id);
      if (members.length === 0 || !members.every((m) => m.round?.finished)) continue;
      team.round.finish('attempts', now);
      closed = true;
    }
    if (closed) this.publishTeamClocks(room, now);
    return closed;
  }

  /** Team mode: the shared clocks, to the whole room. */
  publishTeamClocks(room: Room, now: number): void {
    if (room.teams.length === 0) return;
    this.bus.publish({
      roomCode: room.code,
      event: 'team:clocks',
      payload: room.teams.map((team) => toTeamRoundState(team, now, room.phrase)),
    });
  }

  /** Team mode: a member's board with letters, to their teammates only. */
  publishTeammateRows(room: Room, player: Player): void {
    if (player.team === null) return;
    const payload = toTeammateRows(player, room.phrase);
    for (const mate of room.members(player.team)) {
      if (mate.id === player.id || !mate.connected) continue;
      this.bus.publish({
        roomCode: room.code,
        toPlayerId: mate.id,
        event: 'teammate:progress',
        payload,
      });
    }
  }

  /**
   * Team mode: a team whose members have all run out of attempts is done, the
   * clock notwithstanding. Returns true when the team round just closed.
   */
  closeTeamIfSpent(room: Room, player: Player, now: number): boolean {
    const team = room.teamOf(player);
    if (!team?.round || team.round.finished) return false;
    const members = room.members(team.id);
    if (members.length === 0 || !members.every((m) => m.round?.finished)) return false;
    team.round.finish('attempts', now);
    return true;
  }

  publishProgress(room: Room, player: Player, now: number): void {
    this.bus.publish({
      roomCode: room.code,
      event: 'player:progress',
      payload: toPlayerProgress(player, now, room.phrase),
    });
  }

  /** `player:solved`, then -5 s to everyone still playing, then `time:penalty`. */
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

    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
    // The humans are a team: a human solve damages only the fly, and only the
    // fly damages humans. Same mechanic, different target
    // (docs/context/08-boss-mode.md). Boss mode is never a team game, so this
    // replaces the whole branch below rather than interleaving with it.
    if (room.settings.bossMode === true) {
      const bossPenalty = solver.isBot
        ? SCORING.penaltyOnRivalSolveSeconds
        : BOSS.damageOnHumanSolve;
      const hits: { playerId: string; secondsLeft: number; at: number }[] = [];
      for (const rival of room.players) {
        const round = rival.round;
        if (rival.id === solver.id || !round || round.solved || round.finished) continue;
        // Nobody hits their own side.
        if (rival.isBot === solver.isBot) continue;
        round.applyPenalty(bossPenalty);
        hits.push({ playerId: rival.id, secondsLeft: round.secondsLeft(now), at: now });
      }
      this.bus.publish({
        roomCode: room.code,
        event: 'time:penalty',
        payload: { fromPlayerId: solver.id, seconds: bossPenalty, clocks: hits },
      });
      this.finishTimedOut(room, now);
      return;
    }
    // BOSS-MODE — end.

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
    this.publishTeamClocks(room, now);
    // A penalty can push a clock past its deadline: settle those right away.
    this.finishTimedOut(room, now);
  }

  isRoundOver(room: Room): boolean {
    if (room.players.length === 0) return false;
    if (room.teams.length > 0) {
      // A team nobody sits in has nothing to finish.
      return room.teams.every(
        (team) => room.members(team.id).length === 0 || team.round?.finished === true,
      );
    }
    return room.players.every((p) => p.round?.finished === true);
  }

  /** Ends the round if the room is playing and nobody is left in it. */
  endRoundIfOver(room: Room, now: number): boolean {
    if (room.status !== 'playing' || !this.isRoundOver(room)) return false;
    this.endRound.execute(room, now);
    return true;
  }
}
