import { SCORING, type RoundBreakdown, type Standing } from '@shared/contract';

/** What a player ends the round with; the input of the points formula. */
export interface RoundResult {
  playerId: string;
  name: string;
  solved: boolean;
  /** Attempts used (the solving attempt included). */
  attempt: number;
  /** 1st, 2nd, 3rd... to solve; null when not solved. */
  position: number | null;
  /** Frozen clock at solve time; ignored when not solved. */
  secondsLeftAtSolve: number;
  hintUsed: boolean;
  /** Distinct answer positions turned green. */
  greens: number;
  /** Distinct answer positions known (yellow or hinted) but never turned green. */
  yellows: number;
}

/**
 * docs/context/03-scoring-system.md, one player.
 *
 * `bossBonus` is the flat team reward for the round the fly went down; it is 0
 * outside boss mode and 0 for the fly herself (docs/context/06-boss-mode.md).
 * It sits outside the solve floor so it also rewards a player who lost their
 * own round while the team won it.
 */
export function scoreRound(
  result: RoundResult,
  initialSeconds: number,
  hintEnabled: boolean,
  bossBonus = 0,
  /**
   * The fly is not charged per attempt. She gets 4 where a human gets 8, and
   * her attempts are the only lever her brain has; charging her for using
   * them would be charging her for playing (docs/context/06-boss-mode.md).
   */
  chargeAttempts = true,
): RoundBreakdown {
  const base: RoundBreakdown = {
    playerId: result.playerId,
    name: result.name,
    solved: result.solved,
    attempt: result.attempt,
    position: result.solved ? result.position : null,
    timeLeftPercent: null,
    timePoints: 0,
    solveBonus: 0,
    attemptPenalty: 0,
    positionBonus: 0,
    hintBonus: 0,
    greens: result.greens,
    greenPoints: 0,
    yellows: result.yellows,
    yellowPoints: 0,
    bossBonus,
    roundPoints: 0,
  };

  if (!result.solved) {
    base.greenPoints = SCORING.pointsPerGreenUnsolved * result.greens;
    base.yellowPoints = SCORING.pointsPerYellowUnsolved * result.yellows;
    base.roundPoints = base.greenPoints + base.yellowPoints + bossBonus;
    return base;
  }

  const percent = Math.round((result.secondsLeftAtSolve / initialSeconds) * 100);
  base.timeLeftPercent = percent;
  base.timePoints = percent;
  base.solveBonus = SCORING.solveBonus;
  base.attemptPenalty = chargeAttempts
    ? -SCORING.attemptPenalty * Math.max(0, result.attempt - 1)
    : 0;
  const position = result.position ?? 0;
  base.positionBonus =
    position >= 1 && position <= SCORING.positionBonus.length
      ? SCORING.positionBonus[position - 1]
      : 0;
  base.hintBonus = hintEnabled && !result.hintUsed ? SCORING.hintKeptBonus : 0;

  // The solve bonus is also the minimum: penalties never eat into it, so a solve
  // (>= 40) always outscores the best possible consolation (36).
  base.roundPoints =
    Math.max(
      SCORING.solveBonus,
      base.timePoints + base.solveBonus + base.attemptPenalty + base.positionBonus + base.hintBonus,
    ) + bossBonus;
  return base;
}

export interface StandingInput {
  playerId: string;
  name: string;
  total: number;
  attempts: number;
  hintsUsed: number;
}

/** Sorted table: points desc, then fewer total attempts, then fewer hints used. */
export function computeStandings(players: StandingInput[]): Standing[] {
  const sorted = [...players].sort(
    (a, b) =>
      b.total - a.total ||
      a.attempts - b.attempts ||
      a.hintsUsed - b.hintsUsed ||
      a.name.localeCompare(b.name),
  );
  const standings: Standing[] = [];
  sorted.forEach((p, index) => {
    const prev = standings[index - 1];
    const tiedWithPrev =
      prev !== undefined &&
      prev.total === p.total &&
      prev.attempts === p.attempts &&
      prev.hintsUsed === p.hintsUsed;
    standings.push({ ...p, rank: tiedWithPrev ? prev.rank : index + 1 });
  });
  return standings;
}
