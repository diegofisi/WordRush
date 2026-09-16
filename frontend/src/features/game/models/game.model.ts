import {
  PHRASE_RULES,
  type Emote,
  type GainKind,
  type OwnRow,
  type PhraseProgress,
  type PlayerProgress,
  type TeamColor,
  type TeamId,
  type TeamRoundState,
  type TileColor,
} from '@/shared/contract';
import { percentOf } from '@/shared/lib/format';

export interface RosterEntry {
  name: string;
  connected: boolean;
  /** Team mode only. */
  team: TeamId | null;
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
  greens: number;
  /** Phrase game: where they have letters, never which. */
  phrase: PhraseProgress | null;
}

/** A teammate: letters included, they play the same word with me. */
export interface TeammateViewModel {
  id: string;
  name: string;
  connected: boolean;
  rows: OwnRow[];
  /** They are the one who solved it for the team. */
  isSolver: boolean;
  hasLeft: boolean;
}

export interface TeamHeaderViewModel {
  id: TeamId;
  name: string;
  color: TeamColor;
  roundsWon: number;
}

/** The rival team during the round: one clock, colours-only members. */
export interface RivalTeamViewModel extends TeamHeaderViewModel {
  secondsLeft: number;
  at: number;
  solved: boolean;
  solvedPosition: number | null;
  solverName: string | null;
  finished: boolean;
  timePercent: number | null;
  members: RivalViewModel[];
  /** Phrase game: the rival team's shared phrase. */
  phrase: PhraseProgress | null;
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
  | { kind: 'left' }
  | { kind: 'new-host' }
  /** Team mode: a whole team ran out of time or attempts. */
  | { kind: 'team-finished'; teamName: string; reason: 'attempts' | 'time' | 'sends' }
  /** Phrase game: somebody spent their five sends. */
  | { kind: 'out-of-sends' }
  /** Phrase game: a send at the whole phrase. */
  | { kind: 'phrase-completed'; position: number }
  | { kind: 'phrase-missed' }
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
  maxAttempts = 8,
): RivalViewModel => {
  // Phrase game: the round ends by sends, whatever the number of words typed.
  const outOfAttempts = progress.phrase
    ? progress.phrase.sendsUsed >= PHRASE_RULES.sends
    : progress.rows.length >= maxAttempts;
  const status: RivalStatus = hasLeft
    ? 'left'
    : progress.solved
      ? 'solved'
      : progress.finished
        ? outOfAttempts
          ? 'out-of-attempts'
          : 'out-of-time'
        : 'playing';
  return {
    id: progress.playerId,
    name: roster?.name ?? '?',
    connected: hasLeft ? false : (roster?.connected ?? true),
    // Defensive: the contract has no letters for rivals, and we never keep any.
    rows: progress.rows.map((row) => [...row]),
    currentAttempt: Math.min(maxAttempts, progress.rows.length + 1),
    secondsLeft: progress.secondsLeft,
    at: progress.at,
    status,
    solvedPosition: progress.solvedPosition,
    timePercent: progress.solved ? percentOf(progress.secondsLeft, initialSeconds) : null,
    greens: progress.greens,
    phrase: progress.phrase,
  };
};

export const toTeammateViewModel = (
  playerId: string,
  rows: OwnRow[],
  roster: RosterEntry | undefined,
  solverId: string | null,
  hasLeft = false,
): TeammateViewModel => ({
  id: playerId,
  name: roster?.name ?? '?',
  connected: hasLeft ? false : (roster?.connected ?? true),
  rows: rows.map((row) => ({ word: row.word, colors: [...row.colors] })),
  isSolver: solverId === playerId,
  hasLeft,
});

export const toRivalTeamViewModel = (
  header: TeamHeaderViewModel,
  state: TeamRoundState,
  members: RivalViewModel[],
  solverName: string | null,
  initialSeconds: number,
): RivalTeamViewModel => ({
  ...header,
  secondsLeft: state.secondsLeft,
  at: state.at,
  solved: state.solved,
  solvedPosition: state.solvedPosition,
  solverName,
  finished: state.finished,
  timePercent: state.solved ? percentOf(state.secondsLeft, initialSeconds) : null,
  members,
  phrase: state.phrase,
});
