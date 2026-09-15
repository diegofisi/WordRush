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

export type RivalStatus = 'playing' | 'solved' | 'out-of-attempts' | 'out-of-time' | 'left';

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
  | {
      kind: 'solved';
      position: number;
      /** Boss mode: a human solve takes the time off the fly, not off the room. */
      hitBoss?: boolean;
    }
  | { kind: 'hint' }
  | { kind: 'reaction'; emote: Emote }
  | { kind: 'greens'; greens: number }
  | { kind: 'low-time' }
  | { kind: 'out-of-attempts' }
  | { kind: 'out-of-time' }
  | { kind: 'left' }
  | { kind: 'new-host' }
);

/** Everything the feed still renders as one line; stickers are their own block. */
export type TextFeedEvent = Exclude<FeedEvent, { kind: 'reaction' }>;

export const isTextFeedEvent = (event: FeedEvent): event is TextFeedEvent =>
  event.kind !== 'reaction';

export interface GainChip {
  id: number;
  letter: string;
  seconds: number;
  kind: GainKind;
}

/**
 * The newest sticker, for the phone overlay: `id` changes on every arrival so
 * the overlay restarts its 2.5 s window even for the same emote twice in a row.
 */
export interface StickerFlash {
  id: number;
  emote: Emote;
  name: string;
}

export type KeyState = 'green' | 'yellow' | 'gray' | 'hint';

export type HintButtonState = 'available' | 'used' | 'off';

export const toRivalViewModel = (
  progress: PlayerProgress,
  roster: RosterEntry | undefined,
  initialSeconds: number,
  /** They gave up their seat (`room:leave`); the panel keeps them, greyed out. */
  hasLeft = false,
): RivalViewModel => {
  const status: RivalStatus = hasLeft
    ? 'left'
    : progress.solved
      ? 'solved'
      : progress.finished
        ? progress.rows.length >= MAX_ATTEMPTS
          ? 'out-of-attempts'
          : 'out-of-time'
        : 'playing';
  return {
    id: progress.playerId,
    name: roster?.name ?? '?',
    connected: hasLeft ? false : (roster?.connected ?? true),
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
