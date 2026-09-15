import type { Emote, HintReveal, Language, OwnRow, RoundInfo } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

import type { ScorePreview } from '../helpers/scorePreview';
import type { TeamScorePreview } from '../helpers/teamScorePreview';
import type {
  FeedEvent,
  GainChip,
  HintButtonState,
  KeyState,
  RivalTeamViewModel,
  RivalViewModel,
  StickerFlash,
  TeamHeaderViewModel,
  TeammateViewModel,
} from './game.model';

export interface ClockViewModel {
  secondsLeft: number;
  percent: number;
  /** Frozen once I finished (solved, out of attempts, out of time). */
  frozen: boolean;
  low: boolean;
}

/** `team-solved`: a teammate found the word, so I am done too. */
export type MyOutcome = 'playing' | 'solved' | 'out-of-attempts' | 'out-of-time' | 'team-solved';

/** Team mode only (docs/context/06-v1.1.md -> Teams): my team and the rival one. */
export interface TeamViewProps {
  mine: TeamHeaderViewModel;
  /** Who solved it for us; null until then. */
  solverName: string | null;
  teammates: TeammateViewModel[];
  /** Null while the other team has nobody in it. */
  rival: RivalTeamViewModel | null;
  /** Derived seconds left of the rival team's clock at the current tick. */
  rivalClock: number;
  preview: TeamScorePreview;
}

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
  /** Screen-reader wording for each tile/key state, derived once from `t`. */
  tileLabels: Record<KeyState, string>;
  outcome: MyOutcome;
  solvedPosition: number | null;
  rivals: RivalViewModel[];
  /** Derived seconds left per rival at the current tick. */
  rivalClocks: Record<string, number>;
  solvedCount: number;
  feed: FeedEvent[];
  /** Newest sticker from anyone; only the phone layout shows it (overlay). */
  sticker: StickerFlash | null;
  preview: ScorePreview;
  /** Present in team mode only; the layouts swap the rivals panel and score card. */
  team: TeamViewProps | null;
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
