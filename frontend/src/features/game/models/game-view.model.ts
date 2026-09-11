import type { Emote, HintReveal, Language, OwnRow, RoundInfo } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

import type { ScorePreview } from '../helpers/scorePreview';
import type {
  FeedEvent,
  GainChip,
  HintButtonState,
  KeyState,
  ReactionBubble,
  RivalViewModel,
} from './game.model';

export interface ClockViewModel {
  secondsLeft: number;
  percent: number;
  /** Frozen once I finished (solved, out of attempts, out of time). */
  frozen: boolean;
  low: boolean;
}

export type MyOutcome = 'playing' | 'solved' | 'out-of-attempts' | 'out-of-time';

/** Everything the desktop and phone layouts need, already derived. */
export interface GameViewProps {
  t: Dictionary;
  roomCode: string;
  round: RoundInfo;
  wordLanguage: Language;
  clock: ClockViewModel;
  gains: GainChip[];
  penaltySeconds: number;
  rows: OwnRow[];
  draft: string;
  hint: HintReveal | null;
  revealRow: number | null;
  shakeKey: number;
  keyStates: Record<string, KeyState>;
  outcome: MyOutcome;
  solvedPosition: number | null;
  rivals: RivalViewModel[];
  /** Derived seconds left per rival at the current tick. */
  rivalClocks: Record<string, number>;
  solvedCount: number;
  feed: FeedEvent[];
  reactions: Record<string, ReactionBubble>;
  preview: ScorePreview;
  hintState: HintButtonState;
  hintPending: boolean;
  /** Seconds left of the emote burst pause; 0 while the player may react. */
  emoteCooldownSeconds: number;
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  onHint: () => void;
  onEmote: (emote: Emote) => void;
}
