import type { GameEndPayload, RoundBreakdown, RoundEndPayload, Standing } from '@/shared/contract';

export interface BreakdownRowViewModel extends RoundBreakdown {
  rank: number;
  isMe: boolean;
}

export interface StandingViewModel extends Standing {
  isMe: boolean;
  /** Bar width relative to the leader, 0–100. */
  barPercent: number;
}

export interface RoundResultsViewModel {
  round: number;
  totalRounds: number;
  word: string;
  rows: BreakdownRowViewModel[];
  standings: StandingViewModel[];
  solvedCount: number;
  playerCount: number;
  first: BreakdownRowViewModel | null;
  myRow: BreakdownRowViewModel | null;
  myStanding: StandingViewModel | null;
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

export const toRoundResultsViewModel = (
  payload: RoundEndPayload,
  myId: string | null,
  gameEnd: GameEndPayload | null,
): RoundResultsViewModel => {
  const rows = [...payload.breakdown]
    .sort(byRoundResult)
    .map((row, index) => ({ ...row, rank: index + 1, isMe: row.playerId === myId }));
  const standings = toStandingViewModels(gameEnd?.standings ?? payload.standings, myId);
  return {
    round: payload.round,
    totalRounds: payload.totalRounds,
    word: payload.word.toUpperCase(),
    rows,
    standings,
    solvedCount: rows.filter((row) => row.solved).length,
    playerCount: rows.length,
    first: rows.find((row) => row.position === 1) ?? null,
    myRow: rows.find((row) => row.isMe) ?? null,
    myStanding: standings.find((standing) => standing.isMe) ?? null,
    isFinal: gameEnd !== null || payload.nextRoundIn === 0 || payload.round >= payload.totalRounds,
  };
};
