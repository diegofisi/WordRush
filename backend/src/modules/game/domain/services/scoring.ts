import {
  PHRASE_RULES,
  SCORING,
  type RoundBreakdown,
  type Standing,
  type TeamColor,
  type TeamId,
  type TeamRoundBreakdown,
  type TeamStanding,
} from '@shared/contract';

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

/** docs/context/03-scoring-system.md, one player. */
export function scoreRound(
  result: RoundResult,
  initialSeconds: number,
  hintEnabled: boolean,
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — two optional
  // trailing arguments, both inert outside boss mode.
  /**
   * The flat team reward for the round the fly went down; 0 outside boss mode
   * and 0 for the fly herself. It sits outside the solve floor so it also
   * rewards a player who lost their own round while the team won it.
   */
  bossBonus = 0,
  /**
   * The fly is not charged per attempt: her attempts are the only lever her
   * brain has (docs/context/08-boss-mode.md).
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
    phrasePercent: 0,
    uncoveredPoints: 0,
    sendsFailed: 0,
    sendPenalty: 0,
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
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
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md): `chargeAttempts`.
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
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md): `+ bossBonus`.
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

/** What a team ends the round with (docs/context/06-v1.1.md -> Team scoring). */
export interface TeamRoundResult {
  team: TeamId;
  name: string;
  color: TeamColor;
  solved: boolean;
  solverId: string | null;
  solverName: string | null;
  /** 1st or 2nd team to solve; null when not solved. */
  position: number | null;
  secondsLeftAtSolve: number;
  hintUsed: boolean;
  /** Every member's attempts after their first. */
  attemptsAfterFirst: number;
}

/**
 * One team, one score: +40 for the solve, the team clock's percentage, +20 to
 * the first team only, −4 per attempt of every member after their first, +10
 * for the hint kept. Floor 40 on a solve; 0 without one.
 */
export function scoreTeamRound(
  result: TeamRoundResult,
  initialSeconds: number,
  hintEnabled: boolean,
): TeamRoundBreakdown {
  const base: TeamRoundBreakdown = {
    team: result.team,
    name: result.name,
    color: result.color,
    solved: result.solved,
    solverId: result.solverId,
    solverName: result.solverName,
    position: result.solved ? result.position : null,
    timeLeftPercent: null,
    timePoints: 0,
    solveBonus: 0,
    attemptsAfterFirst: result.attemptsAfterFirst,
    attemptPenalty: 0,
    positionBonus: 0,
    hintBonus: 0,
    wordsSent: 0,
    phrasePercent: 0,
    uncoveredPoints: 0,
    sendsFailed: 0,
    sendPenalty: 0,
    roundPoints: 0,
  };
  if (!result.solved) return base;
  const percent = Math.round((result.secondsLeftAtSolve / initialSeconds) * 100);
  base.timeLeftPercent = percent;
  base.timePoints = percent;
  base.solveBonus = SCORING.solveBonus;
  base.attemptPenalty = -SCORING.attemptPenalty * result.attemptsAfterFirst;
  base.positionBonus = result.position === 1 ? SCORING.teamFirstBonus : 0;
  base.hintBonus = hintEnabled && !result.hintUsed ? SCORING.hintKeptBonus : 0;
  base.roundPoints = Math.max(
    SCORING.solveBonus,
    base.timePoints + base.solveBonus + base.attemptPenalty + base.positionBonus + base.hintBonus,
  );
  return base;
}

export interface TeamStandingInput {
  team: TeamId;
  name: string;
  color: TeamColor;
  total: number;
  roundsWon: number;
  gamesWon: number;
}

/** Points desc, then rounds won; equal on both = same rank. */
export function computeTeamStandings(teams: TeamStandingInput[]): TeamStanding[] {
  const sorted = [...teams].sort((a, b) => b.total - a.total || b.roundsWon - a.roundsWon);
  return sorted.map((team, index) => {
    const prev = sorted[index - 1];
    const tied =
      prev !== undefined && prev.total === team.total && prev.roundsWon === team.roundsWon;
    return { ...team, rank: tied ? index : index + 1 };
  });
}

// ---------------------------------------------------------------------------
// Guess the phrase (docs/context/06-v1.1.md)
// ---------------------------------------------------------------------------

/** What a player ends a phrase round with. */
export interface PhraseRoundResult {
  playerId: string;
  name: string;
  completed: boolean;
  /** 1st, 2nd... to complete; null otherwise. */
  position: number | null;
  secondsLeftAtSolve: number;
  wordsSent: number;
  sendsFailed: number;
  /** Share of the phrase uncovered, 0-100. */
  percent: number;
}

/** The uncovered share: up to `uncoveredMaxPoints` at 100 %, only when not completed. */
const uncoveredPoints = (percent: number) =>
  Math.round((percent / 100) * PHRASE_RULES.uncoveredMaxPoints);

/**
 * One player, the phrase game: +80 for the phrase, the clock's percentage,
 * the completion order bonus, −4 per word typed, −5 per failed send; the
 * completion bonus is the floor of a completed round (like Wordle's 40).
 * Without the phrase: the uncovered share minus the failed sends, never
 * below 0.
 */
export function scorePhraseRound(
  result: PhraseRoundResult,
  initialSeconds: number,
): RoundBreakdown {
  const base: RoundBreakdown = {
    playerId: result.playerId,
    name: result.name,
    solved: result.completed,
    attempt: result.wordsSent,
    position: result.completed ? result.position : null,
    timeLeftPercent: null,
    timePoints: 0,
    solveBonus: 0,
    attemptPenalty: -PHRASE_RULES.wordPenalty * result.wordsSent,
    positionBonus: 0,
    hintBonus: 0,
    greens: 0,
    greenPoints: 0,
    yellows: 0,
    yellowPoints: 0,
    phrasePercent: result.percent,
    uncoveredPoints: 0,
    sendsFailed: result.sendsFailed,
    sendPenalty: -PHRASE_RULES.sendPenalty * result.sendsFailed,
    roundPoints: 0,
  };
  if (!result.completed) {
    base.attemptPenalty = 0;
    base.uncoveredPoints = uncoveredPoints(result.percent);
    base.roundPoints = Math.max(0, base.uncoveredPoints + base.sendPenalty);
    return base;
  }
  const percent = Math.round((result.secondsLeftAtSolve / initialSeconds) * 100);
  base.timeLeftPercent = percent;
  base.timePoints = percent;
  base.solveBonus = PHRASE_RULES.completeBonus;
  const position = result.position ?? 0;
  base.positionBonus =
    position >= 1 && position <= SCORING.positionBonus.length
      ? SCORING.positionBonus[position - 1]
      : 0;
  base.roundPoints = Math.max(
    PHRASE_RULES.completeBonus,
    base.timePoints + base.solveBonus + base.attemptPenalty + base.positionBonus + base.sendPenalty,
  );
  return base;
}

export interface TeamPhraseRoundResult {
  team: TeamId;
  name: string;
  color: TeamColor;
  completed: boolean;
  solverId: string | null;
  solverName: string | null;
  position: number | null;
  secondsLeftAtSolve: number;
  /** Every member's words. */
  wordsSent: number;
  sendsFailed: number;
  percent: number;
}

/** One team, the phrase game: as the player formula, +20 to the first team only. */
export function scoreTeamPhraseRound(
  result: TeamPhraseRoundResult,
  initialSeconds: number,
): TeamRoundBreakdown {
  const base: TeamRoundBreakdown = {
    team: result.team,
    name: result.name,
    color: result.color,
    solved: result.completed,
    solverId: result.solverId,
    solverName: result.solverName,
    position: result.completed ? result.position : null,
    timeLeftPercent: null,
    timePoints: 0,
    solveBonus: 0,
    attemptsAfterFirst: 0,
    attemptPenalty: -PHRASE_RULES.wordPenalty * result.wordsSent,
    positionBonus: 0,
    hintBonus: 0,
    wordsSent: result.wordsSent,
    phrasePercent: result.percent,
    uncoveredPoints: 0,
    sendsFailed: result.sendsFailed,
    sendPenalty: -PHRASE_RULES.sendPenalty * result.sendsFailed,
    roundPoints: 0,
  };
  if (!result.completed) {
    base.attemptPenalty = 0;
    base.uncoveredPoints = uncoveredPoints(result.percent);
    base.roundPoints = Math.max(0, base.uncoveredPoints + base.sendPenalty);
    return base;
  }
  const percent = Math.round((result.secondsLeftAtSolve / initialSeconds) * 100);
  base.timeLeftPercent = percent;
  base.timePoints = percent;
  base.solveBonus = PHRASE_RULES.completeBonus;
  base.positionBonus = result.position === 1 ? SCORING.teamFirstBonus : 0;
  base.roundPoints = Math.max(
    PHRASE_RULES.completeBonus,
    base.timePoints + base.solveBonus + base.attemptPenalty + base.positionBonus + base.sendPenalty,
  );
  return base;
}
