import type { Language, WordLength } from '@shared/contract';

export const WORD_LIST = Symbol('WORD_LIST');

/** Read-only access to the per-language word lists loaded at boot. */
export interface IWordList {
  /** True when `word` (already normalised) is an accepted guess in `language`; its length picks the list. */
  isAllowed(language: Language, word: string): boolean;
  /** Words of `length` the game may pick as the round answer. */
  answers(language: Language, length: WordLength): readonly string[];
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  /** Every word a player may type. A superset of `answers`. Boss mode only. */
  guessable(language: Language, length: WordLength): readonly string[];
}
