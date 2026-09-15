import { attemptsFor } from '@shared/contract';
import type {
  FullState,
  PlayerProgress,
  RoundEndPayload,
  RoundState,
  SelfState,
  TeammateRows,
  TeamRoundState,
} from '@shared/contract';
import type { Player } from '../entities/player.entity';
import type { Room } from '../entities/room.entity';
import type { Team } from '../entities/team.entity';

/**
 * Pure mappers from the aggregate to the contract shapes. Colours only for
 * rivals, letters only in the caller's own `SelfState`, never the word.
 */
export function toPlayerProgress(player: Player, now: number): PlayerProgress {
  const round = player.round;
  return {
    playerId: player.id,
    rows: round ? round.rows.map((r) => [...r.colors]) : [],
    attempt: round?.attempt ?? 0,
    secondsLeft: round?.secondsLeft(now) ?? 0,
    at: now,
    solved: round?.solved ?? false,
    solvedPosition: round?.solvedPosition ?? null,
    finished: round?.finished ?? false,
    greens: round?.greens ?? 0,
    yellows: round?.yellows ?? 0,
    penaltySeconds: round?.penaltySeconds ?? 0,
  };
}

export function toSelfState(player: Player, now: number): SelfState {
  const round = player.round;
  return {
    rows: round ? round.rows.map((r) => ({ word: r.word, colors: [...r.colors] })) : [],
    secondsLeft: round?.secondsLeft(now) ?? 0,
    at: now,
    solved: round?.solved ?? false,
    finished: round?.finished ?? false,
    hintUsed: round?.hintUsed ?? false,
    hint: round?.hint ? { ...round.hint } : null,
    penaltySeconds: round?.penaltySeconds ?? 0,
  };
}

export function toTeamRoundState(team: Team, now: number): TeamRoundState {
  const round = team.round;
  return {
    id: team.id,
    secondsLeft: round?.secondsLeft(now) ?? 0,
    at: now,
    solved: round?.solved ?? false,
    solvedPosition: round?.solvedPosition ?? null,
    solverId: round?.solverId ?? null,
    finished: round?.finished ?? false,
    hintUsed: round?.hintUsed ?? false,
    penaltySeconds: round?.penaltySeconds ?? 0,
    attemptsAfterFirst: round?.attemptsAfterFirst ?? 0,
  };
}

/** A teammate's board with letters: only teammates ever receive this. */
export function toTeammateRows(player: Player): TeammateRows {
  return {
    playerId: player.id,
    rows: player.round
      ? player.round.rows.map((r) => ({ word: r.word, colors: [...r.colors] }))
      : [],
  };
}

export function toRoundState(room: Room, player: Player, now: number): RoundState {
  const teammates =
    player.team === null
      ? []
      : room
          .members(player.team)
          .filter((p) => p.id !== player.id)
          .map(toTeammateRows);
  return {
    round: room.currentRound,
    totalRounds: room.settings.rounds,
    mode: room.settings.mode,
    wordLength: room.settings.wordLength,
    maxAttempts: attemptsFor(room.settings.wordLength),
    initialSeconds: room.settings.initialSeconds,
    startedAt: room.roundStartedAt,
    hintAvailable: room.settings.hintEnabled,
    me: toSelfState(player, now),
    players: room.players.map((p) => toPlayerProgress(p, now)),
    teams: room.teams.map((team) => toTeamRoundState(team, now)),
    myTeam: player.team,
    teammates,
  };
}

/**
 * The stored payload carries the countdown as it was when the round ended. A
 * client arriving later (rejoin after a reload) must get what is *left*, or its
 * countdown restarts from the full 12 s. Never 0 while a round is still coming:
 * the contract reserves 0 for "the game ended".
 */
function withRemainingCountdown(
  payload: RoundEndPayload,
  room: Room,
  now: number,
): RoundEndPayload {
  if (room.status !== 'between-rounds' || room.nextRoundAt === null) return payload;
  return { ...payload, nextRoundIn: Math.max(1, Math.ceil((room.nextRoundAt - now) / 1000)) };
}

export function toFullState(room: Room, player: Player, now: number): FullState {
  const hasRound = room.status === 'playing' || room.status === 'between-rounds';
  const showLastEnd = room.status === 'between-rounds' || room.status === 'finished';
  const lastRoundEnd =
    showLastEnd && room.lastRoundEnd ? withRemainingCountdown(room.lastRoundEnd, room, now) : null;
  return {
    lobby: room.toLobbyState(),
    round: hasRound && player.round ? toRoundState(room, player, now) : null,
    lastRoundEnd,
  };
}
