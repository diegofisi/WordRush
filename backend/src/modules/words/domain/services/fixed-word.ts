import { WORD_LENGTHS, type WordLength } from '@shared/contract';
import { isWordShaped, normalizeWord } from './normalize-word';

/** Only the two variables the hook reads; keeps the guard pure and testable. */
export interface FixedWordEnv {
  NODE_ENV?: string;
  WORDRUSH_FIXED_WORD?: string;
}

/**
 * Testing hook (see `backend/README.md`). When `WORDRUSH_FIXED_WORD` holds a
 * well-shaped 5-, 6- or 7-letter word, every round of that length uses it
 * instead of a random answer (rounds of another length stay random).
 *
 * Hard guard: it is inert whenever `NODE_ENV` is `production`, so a stray
 * variable on the deployed server can never freeze the answer.
 */
export function resolveFixedWord(env: FixedWordEnv): string | null {
  if (env.NODE_ENV === 'production') return null;
  const raw = env.WORDRUSH_FIXED_WORD;
  if (!raw) return null;
  const word = normalizeWord(raw);
  return WORD_LENGTHS.some((length: WordLength) => isWordShaped(word, length)) ? word : null;
}
