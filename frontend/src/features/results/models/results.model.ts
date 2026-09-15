import type {
  GameEndPayload,
  GameMode,
  RoundBreakdown,
  RoundEndPayload,
  Standing,
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

export interface RoundResultsViewModel {
  mode: GameMode;
  round: number;
  totalRounds: number;
  word: string;
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
    round: payload.round,
    totalRounds: payload.totalRounds,
    word: payload.word.toUpperCase(),
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
  };
};
