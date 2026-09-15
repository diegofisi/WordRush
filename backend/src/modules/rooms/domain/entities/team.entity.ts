import type { HintReveal, TeamColor, TeamId, TeamPublic } from '@shared/contract';
import type { PhraseProgress } from './phrase-progress.entity';
import type { FinishReason, HintPick, PositionCharge } from './player-round.entity';

/**
 * One team's round (docs/context/06-v1.1.md -> Teams): the clock every member
 * plays on, the ledger paid once per answer position for the whole team, the
 * team's single hint and its solve. Members keep their own rows; everything
 * that is time or points lives here.
 */
export class TeamRound {
  deadlineAt: number;
  frozenSecondsLeft: number | null = null;
  solved = false;
  solvedPosition: number | null = null;
  /** The member who solved for the team. */
  solverId: string | null = null;
  finished = false;
  finishReason: FinishReason | null = null;
  hintUsed = false;
  hint: HintReveal | null = null;
  penaltySeconds = 0;
  /** Words sent by every member, the penalty base (each member's first is free). */
  attemptsAfterFirst = 0;
  /** Phrase game: the team's shared phrase progress. */
  phrase: PhraseProgress | null = null;
  readonly charges: PositionCharge[];

  constructor(startedAt: number, initialSeconds: number, wordLength: number) {
    this.deadlineAt = startedAt + initialSeconds * 1000;
    this.charges = Array.from({ length: wordLength }, () => ({
      yellow: false,
      green: false,
      hinted: false,
    }));
  }

  secondsLeft(now: number): number {
    if (this.frozenSecondsLeft !== null) return this.frozenSecondsLeft;
    return Math.max(0, Math.round(((this.deadlineAt - now) / 1000) * 100) / 100);
  }

  isOutOfTime(now: number): boolean {
    return !this.finished && this.deadlineAt <= now;
  }

  addSeconds(seconds: number): void {
    this.deadlineAt += seconds * 1000;
  }

  applyPenalty(seconds: number): void {
    this.penaltySeconds += seconds;
    this.addSeconds(-seconds);
  }

  finish(reason: FinishReason, now: number): void {
    if (this.finished) return;
    this.frozenSecondsLeft = reason === 'timeout' ? 0 : this.secondsLeft(now);
    this.finished = true;
    this.finishReason = reason;
  }

  markSolved(position: number, solverId: string, now: number): void {
    this.solved = true;
    this.solvedPosition = position;
    this.solverId = solverId;
    this.finish('solved', now);
  }

  revealHint(pick: HintPick): void {
    this.hintUsed = true;
    this.hint = {
      letter: pick.letter,
      kind: pick.kind,
      position: pick.kind === 'position' ? pick.position : null,
    };
    const charge = this.charges[pick.position];
    charge.hinted = true;
    if (pick.kind === 'position') charge.green = true;
  }
}

/** Default colours: the first team violet, the second gold, as in the mockups. */
export const DEFAULT_TEAM_COLORS: Record<TeamId, TeamColor> = { a: 'violet', b: 'gold' };

/**
 * A team of the room: identity chosen by its members in the lobby (name and
 * colour), the two win counters, and the current round. `gamesWon` survives
 * "play again" because the room does; the host can reset it.
 */
export class Team {
  name = '';
  color: TeamColor;
  roundsWon = 0;
  gamesWon = 0;
  /** Points accumulated over the rounds of the current game. */
  totalPoints = 0;
  round: TeamRound | null = null;

  constructor(readonly id: TeamId) {
    this.color = DEFAULT_TEAM_COLORS[id];
  }

  resetForNewGame(): void {
    this.roundsWon = 0;
    this.totalPoints = 0;
    this.round = null;
  }

  toPublic(): TeamPublic {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      roundsWon: this.roundsWon,
      gamesWon: this.gamesWon,
    };
  }
}
