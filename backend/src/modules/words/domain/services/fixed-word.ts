import { WORD_LENGTH } from '@shared/contract';
import { isWordShaped, normalizeWord } from './normalize-word';

/** Only the two variables the hook reads; keeps the guard pure and testable. */
export interface FixedWordEnv {
  NODE_ENV?: string;
  WORDRUSH_FIXED_WORD?: string;
}

/**
 * Testing hook (see `backend/README.md`). When `WORDRUSH_FIXED_WORD` holds a
 * well-shaped 5-letter word, every round uses it instead of a random answer.
 *
 * Hard guard: it is inert whenever `NODE_ENV` is `production`, so a stray
 * variable on the deployed server can never freeze the answer.
 */
export function resolveFixedWord(env: FixedWordEnv): string | null {
  if (env.NODE_ENV === 'production') return null;
  const raw = env.WORDRUSH_FIXED_WORD;
  if (!raw) return null;
  const word = normalizeWord(raw);
  return isWordShaped(word, WORD_LENGTH) ? word : null;
}
