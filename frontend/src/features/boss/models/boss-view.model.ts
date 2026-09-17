import type { BossDecisionState, BossFrame, TileColor } from '@/shared/contract';

/**
 * The fly's clock as the panel draws it. Boss mode only.
 * docs/context/08-boss-mode.md, docs/context/07-boss-removal.md
 */
export interface BossViewModel {
  id: string;
  /** Ticking seconds left, derived at the current frame. */
  secondsLeft: number;
  /** Health left, 0-100, against the clock she started the round with. */
  percent: number;
  startSeconds: number;
  damageSeconds: number;
  /** What the letters would have paid her under a no-healing rule; 0 today. */
  forfeitedSeconds: number;
  attempt: number;
  solved: boolean;
  defeated: boolean;
  /** Colours only, exactly like a rival's board. */
  rows: TileColor[][];
  /** How wide her board is; she only ever plays the five-letter game. */
  wordLength: number;
  /** Her last decision, and what her brain did while making it. */
  decision: BossDecisionState | null;
  /** The most recent live slice, several times a second while watched. */
  frame: BossFrame | null;
}
