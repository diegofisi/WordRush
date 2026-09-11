import {
  MAX_ATTEMPTS,
  type Emote,
  type GainKind,
  type PlayerProgress,
  type TileColor,
} from '@/shared/contract';
import { percentOf } from '@/shared/lib/format';

export interface RosterEntry {
  name: string;
  connected: boolean;
}

export type RivalStatus = 'playing' | 'solved' | 'out-of-attempts' | 'out-of-time';

/** A rival as the panel shows it: colours only, never letters. */
export interface RivalViewModel {
  id: string;
  name: string;
  connected: boolean;
  rows: TileColor[][];
  /** 1-based attempt currently in progress (rows submitted + 1). */
  currentAttempt: number;
  secondsLeft: number;
  at: number;
  status: RivalStatus;
  solvedPosition: number | null;
  /** Percent of the initial time frozen at solve; null while playing. */
  timePercent: number | null;
  hintUsed: boolean;
  greens: number;
}

export type FeedEvent = {
  id: number;
  atSeconds: number;
  playerId: string;
  name: string;
  isMe: boolean;
} & (
  | { kind: 'solved'; position: number }
  | { kind: 'hint' }
  | { kind: 'reaction'; emote: Emote }
  | { kind: 'greens'; greens: number }
  | { kind: 'low-time' }
  | { kind: 'out-of-attempts' }
  | { kind: 'out-of-time' }
);

export interface GainChip {
  id: number;
  letter: string;
  seconds: number;
  kind: GainKind;
}

export interface ReactionBubble {
  emote: Emote;
  stamp: number;
}

export type KeyState = 'green' | 'yellow' | 'gray' | 'hint';

export type HintButtonState = 'available' | 'used' | 'off';

export const toRivalViewModel = (
  progress: PlayerProgress,
  roster: RosterEntry | undefined,
  initialSeconds: number,
): RivalViewModel => {
  const status: RivalStatus = progress.solved
    ? 'solved'
    : progress.finished
      ? progress.rows.length >= MAX_ATTEMPTS
        ? 'out-of-attempts'
        : 'out-of-time'
      : 'playing';
  return {
    id: progress.playerId,
    name: roster?.name ?? '?',
    connected: roster?.connected ?? true,
    // Defensive: the contract has no letters for rivals, and we never keep any.
    rows: progress.rows.map((row) => [...row]),
    currentAttempt: Math.min(MAX_ATTEMPTS, progress.rows.length + 1),
    secondsLeft: progress.secondsLeft,
    at: progress.at,
    status,
    solvedPosition: progress.solvedPosition,
    timePercent: progress.solved ? percentOf(progress.secondsLeft, initialSeconds) : null,
    hintUsed: progress.hintUsed,
    greens: progress.greens,
  };
};
