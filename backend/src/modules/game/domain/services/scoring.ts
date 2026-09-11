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
}

/** docs/context/03-sistema-de-puntuacion.md, one player. */
export function scoreRound(
  result: RoundResult,
  initialSeconds: number,
  hintEnabled: boolean,
): RoundBreakdown {
  const base: RoundBreakdown = {
    playerId: result.playerId,
    name: result.name,
    solved: result.solved,
    attempt: result.attempt,
    position: result.solved ? result.position : null,
    timeLeftPercent: null,
    timePoints: 0,
    attemptPenalty: 0,
    positionBonus: 0,
    hintBonus: 0,
    greens: result.greens,
    greenPoints: 0,
    floorApplied: false,
    roundPoints: 0,
  };

  if (!result.solved) {
    const greens = Math.min(SCORING.maxGreensUnsolved, result.greens);
    base.greenPoints = SCORING.pointsPerGreenUnsolved * greens;
    base.roundPoints = base.greenPoints;
    return base;
  }

  const percent = Math.round((result.secondsLeftAtSolve / initialSeconds) * 100);
  base.timeLeftPercent = percent;
  base.timePoints = percent;
  base.attemptPenalty = -SCORING.attemptPenalty * Math.max(0, result.attempt - 1);
  const position = result.position ?? 0;
  base.positionBonus =
    position >= 1 && position <= SCORING.positionBonus.length
      ? SCORING.positionBonus[position - 1]
      : 0;
  base.hintBonus = hintEnabled && !result.hintUsed ? SCORING.hintKeptBonus : 0;

  const sum = base.timePoints + base.attemptPenalty + base.positionBonus + base.hintBonus;
  base.floorApplied = sum < SCORING.solveFloor;
  base.roundPoints = Math.max(SCORING.solveFloor, sum);
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
