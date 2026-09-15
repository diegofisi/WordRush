import type { HintKind, HintReveal, OwnRow } from '@shared/contract';
import type { PhraseProgress } from './phrase-progress.entity';
import type { TeamRound } from './team.entity';

/** Time ledger entry for one position of the answer (0..wordLength-1). */
export interface PositionCharge {
  yellow: boolean;
  green: boolean;
  hinted: boolean;
}

/** `team`: a teammate solved, or the team's clock or attempts ran out. */
export type FinishReason = 'solved' | 'attempts' | 'timeout' | 'left' | 'team';

/**
 * What the hint picker resolved. For a letter hint the position stays on the
 * server (it only feeds the ledger); for a placement it travels to the player.
 */
export interface HintPick {
  letter: string;
  position: number;
  kind: HintKind;
}

/**
 * Everything a player accumulates during one round: rows, clock, ledger and
 * hint state. The clock is a deadline in epoch ms; `secondsLeft` is derived
 * from it until the round is finished for this player, when it freezes.
 *
 * In team mode the clock, the ledger, the hint and the penalties are the
 * team's (`TeamRound`), and this object delegates to it: the rows and the
 * finished flag stay per player.
 */
export class PlayerRound {
  readonly rows: OwnRow[] = [];
  deadlineAt: number;
  frozenSecondsLeft: number | null = null;
  solved = false;
  solvedPosition: number | null = null;
  finished = false;
  finishReason: FinishReason | null = null;
  /** Phrase game, normal mode: my own progress (the team's in team mode). */
  ownPhrase: PhraseProgress | null = null;
  private ownHintUsed = false;
  private ownHint: HintReveal | null = null;
  private ownPenaltySeconds = 0;
  private readonly ownCharges: PositionCharge[];

  constructor(
    startedAt: number,
    initialSeconds: number,
    readonly wordLength: number,
    /** Team mode: the round of the player's team. */
    readonly team: TeamRound | null = null,
  ) {
    this.deadlineAt = startedAt + initialSeconds * 1000;
    this.ownCharges = Array.from({ length: wordLength }, () => ({
      yellow: false,
      green: false,
      hinted: false,
    }));
  }

  /** The time ledger: the team's in team mode (paid once per position for everybody). */
  get charges(): PositionCharge[] {
    return this.team ? this.team.charges : this.ownCharges;
  }

  get hintUsed(): boolean {
    return this.team ? this.team.hintUsed : this.ownHintUsed;
  }

  /** Phrase game: the progress that counts, mine or the team's. */
  get phrase(): PhraseProgress | null {
    return this.team ? this.team.phrase : this.ownPhrase;
  }

  get hint(): HintReveal | null {
    return this.team ? this.team.hint : this.ownHint;
  }

  get penaltySeconds(): number {
    return this.team ? this.team.penaltySeconds : this.ownPenaltySeconds;
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
    if (this.team) return this.team.secondsLeft(now);
    if (this.frozenSecondsLeft !== null) return this.frozenSecondsLeft;
    return Math.max(0, Math.round(((this.deadlineAt - now) / 1000) * 100) / 100);
  }

  isOutOfTime(now: number): boolean {
    if (this.team) return !this.finished && this.team.isOutOfTime(now);
    return !this.finished && this.deadlineAt <= now;
  }

  /** Positive = bonus (deadline moves forward), negative = penalty. */
  addSeconds(seconds: number): void {
    if (this.team) this.team.addSeconds(seconds);
    else this.deadlineAt += seconds * 1000;
  }

  applyPenalty(seconds: number): void {
    if (this.team) {
      this.team.applyPenalty(seconds);
      return;
    }
    this.ownPenaltySeconds += seconds;
    this.addSeconds(-seconds);
  }

  /**
   * Freezes the clock and marks the round over for this player. In team mode
   * the team clock keeps running for the others: only the flag is set here.
   */
  finish(reason: FinishReason, now: number): void {
    if (this.finished) return;
    if (!this.team) this.frozenSecondsLeft = reason === 'timeout' ? 0 : this.secondsLeft(now);
    this.finished = true;
    this.finishReason = reason;
  }

  markSolved(position: number, now: number): void {
    this.solved = true;
    this.solvedPosition = position;
    this.finish('solved', now);
  }

  /**
   * Stores the reveal and charges the slot: a hinted letter earns no yellow
   * later (5 s when placed); a placed slot is green already and earns nothing.
   */
  revealHint(pick: HintPick): void {
    if (this.team) {
      this.team.revealHint(pick);
      return;
    }
    this.ownHintUsed = true;
    this.ownHint = {
      letter: pick.letter,
      kind: pick.kind,
      position: pick.kind === 'position' ? pick.position : null,
    };
    const charge = this.ownCharges[pick.position];
    charge.hinted = true;
    if (pick.kind === 'position') charge.green = true;
  }
}
