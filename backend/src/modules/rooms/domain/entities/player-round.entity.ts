import { WORD_LENGTH, type HintReveal, type OwnRow } from '@shared/contract';

/** Time ledger entry for one position of the answer (0..4). */
export interface PositionCharge {
  yellow: boolean;
  green: boolean;
  hinted: boolean;
}

export type FinishReason = 'solved' | 'attempts' | 'timeout' | 'left';

/**
 * What the hint picker resolved internally. The position stays on the server:
 * the contract's `HintReveal` carries the letter and how many times it occurs.
 */
export interface HintPick {
  letter: string;
  position: number;
  /** Occurrences of `letter` in the answer (1..WORD_LENGTH). */
  count: number;
}

/**
 * Everything a player accumulates during one round: rows, clock, ledger and
 * hint state. The clock is a deadline in epoch ms; `secondsLeft` is derived
 * from it until the round is finished for this player, when it freezes.
 */
export class PlayerRound {
  readonly rows: OwnRow[] = [];
  deadlineAt: number;
  frozenSecondsLeft: number | null = null;
  solved = false;
  solvedPosition: number | null = null;
  finished = false;
  finishReason: FinishReason | null = null;
  hintUsed = false;
  hint: HintReveal | null = null;
  penaltySeconds = 0;
  /**
   * Seconds the letters would have paid but did not. Always 0 for a human; the
   * fly forfeits every gain (docs/context/06-boss-mode.md) and the interface
   * shows the number so the rule reads as a handicap.
   */
  forfeitedSeconds = 0;
  readonly charges: PositionCharge[];
  /** The clock this round started with. The fly's differs from the room's. */
  readonly initialSeconds: number;

  constructor(startedAt: number, initialSeconds: number) {
    this.initialSeconds = initialSeconds;
    this.deadlineAt = startedAt + initialSeconds * 1000;
    this.charges = Array.from({ length: WORD_LENGTH }, () => ({
      yellow: false,
      green: false,
      hinted: false,
    }));
  }

  get attempt(): number {
    return this.rows.length;
  }

  /** Distinct answer positions the player has turned green. */
  get greens(): number {
    return this.charges.filter((c) => c.green).length;
  }

  /**
   * Distinct answer positions the player knows hold a letter of the word --
   * charged yellow or revealed by the hint -- and never turned green. A
   * position that was yellow and later went green counts as a green, not here.
   */
  get yellows(): number {
    return this.charges.filter((c) => !c.green && (c.yellow || c.hinted)).length;
  }

  secondsLeft(now: number): number {
    if (this.frozenSecondsLeft !== null) return this.frozenSecondsLeft;
    return Math.max(0, Math.round(((this.deadlineAt - now) / 1000) * 100) / 100);
  }

  isOutOfTime(now: number): boolean {
    return !this.finished && this.deadlineAt <= now;
  }

  /** Positive = bonus (deadline moves forward), negative = penalty. */
  addSeconds(seconds: number): void {
    this.deadlineAt += seconds * 1000;
  }

  applyPenalty(seconds: number): void {
    this.penaltySeconds += seconds;
    this.addSeconds(-seconds);
  }

  /** Freezes the clock and marks the round over for this player. */
  finish(reason: FinishReason, now: number): void {
    if (this.finished) return;
    this.frozenSecondsLeft = reason === 'timeout' ? 0 : this.secondsLeft(now);
    this.finished = true;
    this.finishReason = reason;
  }

  markSolved(position: number, now: number): void {
    this.solved = true;
    this.solvedPosition = position;
    this.finish('solved', now);
  }

  /** Stores the revealed letter and charges the position so it earns no yellow. */
  revealHint(pick: HintPick): void {
    this.hintUsed = true;
    this.hint = { letter: pick.letter, count: pick.count };
    this.charges[pick.position].hinted = true;
  }
}
