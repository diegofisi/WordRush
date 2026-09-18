import type {
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  BossSummary,
  GameEndPayload,
  GameKind,
  GameMode,
  OwnRow,
  RoundBreakdown,
  RoundEndPayload,
  Standing,
  TeamColor,
  TeamId,
  TeamRoundBreakdown,
  TeamStanding,
} from '@/shared/contract';

export interface BreakdownRowViewModel extends RoundBreakdown {
  rank: number;
  isMe: boolean;
}

export interface StandingViewModel extends Standing {
  isMe: boolean;
  /** Bar width relative to the leader, 0–100. */
  barPercent: number;
}

/** Team mode: one card per team (docs/context/06-v1.1.md -> Team scoring). */
export interface TeamBreakdownViewModel extends TeamRoundBreakdown {
  isMine: boolean;
}

export interface TeamStandingViewModel extends TeamStanding {
  isMine: boolean;
  barPercent: number;
}

// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
/**
 * A board at round end, letters included (the word is public). Only the fly
 * has one on this screen since 2026-09-17: the humans' boards were a wall of
 * grids nobody read, and the card was only ever interesting for her.
 */
export interface BoardViewModel {
  playerId: string;
  name: string;
  rows: OwnRow[];
  solved: boolean;
  isMe: boolean;
  /** Team mode: the team's colour. */
  color: TeamColor | null;
}
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.

export interface RoundResultsViewModel {
  mode: GameMode;
  game: GameKind;
  /** Phrase game: the phrase, revealed. */
  phrase: string | null;
  round: number;
  totalRounds: number;
  word: string;
  wordLength: number;
  rows: BreakdownRowViewModel[];
  standings: StandingViewModel[];
  /** Team mode: both teams' round cards, mine first; empty otherwise. */
  teamRows: TeamBreakdownViewModel[];
  teamStandings: TeamStandingViewModel[];
  solvedCount: number;
  playerCount: number;
  first: BreakdownRowViewModel | null;
  /** Team mode: the team that solved first, if any. */
  firstTeam: TeamBreakdownViewModel | null;
  myRow: BreakdownRowViewModel | null;
  myStanding: StandingViewModel | null;
  /** My (or my team's) points this round and overall, whatever the mode. */
  myRoundPoints: number;
  myTotal: number;
  isFinal: boolean;
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
  /** True when the team beat the fly, false when she solved; null otherwise. */
  bossDefeated: boolean | null;
  /** The flat bonus every surviving human took; 0 when she was not beaten. */
  bossBonus: number;
  /** How the fly finished. Null outside boss mode. */
  boss: BossSummary | null;
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.
}

const byRoundResult = (first: RoundBreakdown, second: RoundBreakdown) => {
  if (first.solved !== second.solved) return first.solved ? -1 : 1;
  if (first.solved && second.solved) return (first.position ?? 99) - (second.position ?? 99);
  return second.roundPoints - first.roundPoints;
};

export const toStandingViewModels = (
  standings: Standing[],
  myId: string | null,
): StandingViewModel[] => {
  const sorted = [...standings].sort((first, second) => first.rank - second.rank);
  const top = Math.max(1, ...sorted.map((standing) => standing.total));
  return sorted.map((standing) => ({
    ...standing,
    isMe: standing.playerId === myId,
    barPercent: Math.max(0, Math.round((standing.total / top) * 100)),
  }));
};

export const toTeamStandingViewModels = (
  standings: TeamStanding[],
  myTeam: TeamId | null,
): TeamStandingViewModel[] => {
  const sorted = [...standings].sort((first, second) => first.rank - second.rank);
  const top = Math.max(1, ...sorted.map((standing) => standing.total));
  return sorted.map((standing) => ({
    ...standing,
    isMine: standing.team === myTeam,
    barPercent: Math.max(0, Math.round((standing.total / top) * 100)),
  }));
};

export const toRoundResultsViewModel = (
  payload: RoundEndPayload,
  myId: string | null,
  gameEnd: GameEndPayload | null,
  myTeam: TeamId | null = null,
): RoundResultsViewModel => {
  const rows = [...payload.breakdown]
    .sort(byRoundResult)
    .map((row, index) => ({ ...row, rank: index + 1, isMe: row.playerId === myId }));
  const standings = toStandingViewModels(gameEnd?.standings ?? payload.standings, myId);
  const teamRows = [...payload.teams]
    .map((team) => ({ ...team, isMine: team.team === myTeam }))
    .sort((first, second) => Number(second.isMine) - Number(first.isMine));
  const teamStandings = toTeamStandingViewModels(
    gameEnd?.teamStandings ?? payload.teamStandings,
    myTeam,
  );
  const myRow = rows.find((row) => row.isMe) ?? null;
  const myStanding = standings.find((standing) => standing.isMe) ?? null;
  const myTeamRow = teamRows.find((team) => team.isMine) ?? null;
  const myTeamStanding = teamStandings.find((team) => team.isMine) ?? null;
  const teamMode = payload.mode === 'teams';
  return {
    mode: payload.mode,
    game: payload.game,
    phrase: payload.phrase,
    round: payload.round,
    totalRounds: payload.totalRounds,
    word: payload.word.toUpperCase(),
    wordLength: payload.word.length,
    rows,
    standings,
    teamRows,
    teamStandings,
    solvedCount: teamMode
      ? teamRows.filter((team) => team.solved).length
      : rows.filter((row) => row.solved).length,
    playerCount: teamMode ? teamRows.length : rows.length,
    first: rows.find((row) => row.position === 1) ?? null,
    firstTeam: teamRows.find((team) => team.position === 1) ?? null,
    myRow,
    myStanding,
    myRoundPoints: teamMode ? (myTeamRow?.roundPoints ?? 0) : (myRow?.roundPoints ?? 0),
    myTotal: teamMode ? (myTeamStanding?.total ?? 0) : (myStanding?.total ?? 0),
    isFinal: gameEnd !== null || payload.nextRoundIn === 0 || payload.round >= payload.totalRounds,
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
    bossDefeated: payload.bossDefeated ?? null,
    boss: payload.boss ?? null,
    bossBonus: Math.max(0, ...rows.map((row) => row.bossBonus ?? 0)),
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.
  };
};
