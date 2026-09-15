import type {
  BossDecisionState,
  BossFrame,
  Emote,
  HintReveal,
  Language,
  OwnRow,
  RoundInfo,
  TileColor,
} from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

import type { ScorePreview } from '../helpers/scorePreview';
import type {
  FeedEvent,
  GainChip,
  HintButtonState,
  KeyState,
  RivalViewModel,
  StickerFlash,
} from './game.model';

export interface ClockViewModel {
  secondsLeft: number;
  percent: number;
  /** Frozen once I finished (solved, out of attempts, out of time). */
  frozen: boolean;
  low: boolean;
}

/** The fly's clock as the panel draws it. docs/context/06-boss-mode.md */
export interface BossViewModel {
  id: string;
  /** Ticking seconds left, derived at the current frame. */
  secondsLeft: number;
  /** Health left, 0-100, against the clock she started the round with. */
  percent: number;
  startSeconds: number;
  damageSeconds: number;
  /** What the letters would have paid her under the normal rules. */
  forfeitedSeconds: number;
  attempt: number;
  solved: boolean;
  defeated: boolean;
  /** Colours only, exactly like a rival's board. */
  rows: TileColor[][];
  /** Her last decision, and what her brain did while making it. */
  decision: BossDecisionState | null;
  /** The most recent live slice, several times a second while watched. */
  frame: BossFrame | null;
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
  /** Guess error caption under the current row; the id restarts its 1.6 s fade. */
  guessNotice: { id: number; text: string } | null;
  keyStates: Record<string, KeyState>;
  outcome: MyOutcome;
  solvedPosition: number | null;
  rivals: RivalViewModel[];
  /** Null unless the room is playing against the fly. */
  boss: BossViewModel | null;
  /** Derived seconds left per rival at the current tick. */
  rivalClocks: Record<string, number>;
  solvedCount: number;
  feed: FeedEvent[];
  /** Newest sticker from anyone; only the phone layout shows it (overlay). */
  sticker: StickerFlash | null;
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
