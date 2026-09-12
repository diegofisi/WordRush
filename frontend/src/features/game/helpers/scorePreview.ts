import { SCORING } from '@/shared/contract';

export interface ScorePreviewInput {
  secondsLeft: number;
  initialSeconds: number;
  /** Rows already submitted. */
  attempts: number;
  solved: boolean;
  solvedPosition: number | null;
  finished: boolean;
  /** How many rivals have solved so far (decides the position I would take). */
  solvedCount: number;
  hintEnabled: boolean;
  hintUsed: boolean;
  /** Distinct green positions in my own rows (unsolved consolation). */
  greens: number;
  /** Answer slots I know are in the word but never turned green (unsolved consolation). */
  yellows: number;
}

export interface ScorePreview {
  mode: 'solve' | 'unsolved';
  timePercent: number;
  timePoints: number;
  /** Flat bonus for solving; 0 in the unsolved branch. */
  solveBonus: number;
  /** 1-based attempt the solve happens (or would happen) on. */
  attempt: number;
  attemptsAfterFirst: number;
  attemptPenalty: number;
  position: number;
  positionBonus: number;
  hintKept: boolean;
  hintBonus: number;
  greens: number;
  greenPoints: number;
  yellows: number;
  yellowPoints: number;
  total: number;
}

/** Mirrors docs/context/03-scoring-system.md using the SCORING constants only. */
export const computeScorePreview = (input: ScorePreviewInput): ScorePreview => {
  const hintKept = input.hintEnabled && !input.hintUsed;
  const hintBonus = hintKept ? SCORING.hintKeptBonus : 0;

  if (input.finished && !input.solved) {
    const greenPoints = input.greens * SCORING.pointsPerGreenUnsolved;
    const yellowPoints = input.yellows * SCORING.pointsPerYellowUnsolved;
    return {
      mode: 'unsolved',
      timePercent: 0,
      timePoints: 0,
      solveBonus: 0,
      attempt: input.attempts,
      attemptsAfterFirst: 0,
      attemptPenalty: 0,
      position: 0,
      positionBonus: 0,
      hintKept,
      hintBonus: 0,
      greens: input.greens,
      greenPoints,
      yellows: input.yellows,
      yellowPoints,
      total: greenPoints + yellowPoints,
    };
  }

  const attempt = input.solved ? Math.max(1, input.attempts) : input.attempts + 1;
  const attemptsAfterFirst = Math.max(0, attempt - 1);
  const attemptPenalty = -SCORING.attemptPenalty * attemptsAfterFirst;
  const position =
    input.solved && input.solvedPosition ? input.solvedPosition : input.solvedCount + 1;
  const positionBonus = SCORING.positionBonus[position - 1] ?? 0;
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
    attempt,
    attemptsAfterFirst,
    attemptPenalty,
    position,
    positionBonus,
    hintKept,
    hintBonus,
    greens: input.greens,
    greenPoints: 0,
    yellows: input.yellows,
    yellowPoints: 0,
    total,
  };
};
