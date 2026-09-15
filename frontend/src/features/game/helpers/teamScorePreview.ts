import { SCORING } from '@/shared/contract';

/** docs/context/06-v1.1.md -> Team scoring. */
export interface TeamScorePreviewInput {
  secondsLeft: number;
  initialSeconds: number;
  /** Words every member sent after their own first, so far. */
  attemptsAfterFirst: number;
  /** My rows so far: my next word counts as "after the first" once I have one. */
  myAttempts: number;
  solved: boolean;
  /** 1-based order among the solving teams; null while playing. */
  solvedPosition: number | null;
  finished: boolean;
  /** Teams that already solved (decides whether we would still be first). */
  solvedTeams: number;
  hintEnabled: boolean;
  hintUsed: boolean;
}

export interface TeamScorePreview {
  mode: 'solve' | 'unsolved';
  timePercent: number;
  timePoints: number;
  solveBonus: number;
  attemptsAfterFirst: number;
  attemptPenalty: number;
  first: boolean;
  positionBonus: number;
  hintKept: boolean;
  hintBonus: number;
  total: number;
}

/** Mirrors `scoreTeamRound` on the server using the SCORING constants only. */
export const computeTeamScorePreview = (input: TeamScorePreviewInput): TeamScorePreview => {
  const hintKept = input.hintEnabled && !input.hintUsed;
  if (input.finished && !input.solved) {
    return {
      mode: 'unsolved',
      timePercent: 0,
      timePoints: 0,
      solveBonus: 0,
      attemptsAfterFirst: input.attemptsAfterFirst,
      attemptPenalty: 0,
      first: false,
      positionBonus: 0,
      hintKept,
      hintBonus: 0,
      total: 0,
    };
  }
  const attemptsAfterFirst = input.solved
    ? input.attemptsAfterFirst
    : input.attemptsAfterFirst + (input.myAttempts > 0 ? 1 : 0);
  const attemptPenalty = -SCORING.attemptPenalty * attemptsAfterFirst;
  const first = input.solved ? input.solvedPosition === 1 : input.solvedTeams === 0;
  const positionBonus = first ? SCORING.teamFirstBonus : 0;
  const hintBonus = hintKept ? SCORING.hintKeptBonus : 0;
  const timePercent = Math.max(
    0,
    Math.round((input.secondsLeft / Math.max(1, input.initialSeconds)) * 100),
  );
  const total = Math.max(
    SCORING.solveBonus,
    timePercent + SCORING.solveBonus + attemptPenalty + positionBonus + hintBonus,
  );
  return {
    mode: 'solve',
    timePercent,
    timePoints: timePercent,
    solveBonus: SCORING.solveBonus,
    attemptsAfterFirst,
    attemptPenalty,
    first,
    positionBonus,
    hintKept,
    hintBonus,
    total,
  };
};
