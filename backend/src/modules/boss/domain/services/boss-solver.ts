import { WORD_LENGTH, type TileColor } from '@shared/contract';
import { computeFeedback } from '@modules/game/domain/services/color-feedback';

/**
 * The one piece of deduction the game does on the fly's behalf, and it is
 * declared as such everywhere she appears.
 *
 * This file used to hold a policy and two word pickers as well. Those chose her
 * moves and were deleted on 2026-09-13; what stayed is the part her brain
 * cannot supply and a human player does in their head: striking out every word
 * that contradicts the colours already on the board. She then chooses among
 * what is left, with her own brain, and that choice is the only thing that is
 * hers (docs/context/06-boss-mode.md, docs/context/07-what-the-fly-can-do.md).
 */

function sameColors(a: readonly TileColor[], b: readonly TileColor[]): boolean {
  for (let i = 0; i < WORD_LENGTH; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function occurrences(word: string, letter: string): number {
  let count = 0;
  for (const character of word) if (character === letter) count += 1;
  return count;
}

/**
 * Every word in `pool` that would have produced exactly the colours on every
 * row she has played, and that agrees with the hint if she spent one. Derived
 * from the board each turn rather than narrowed incrementally, so it cannot
 * drift out of step with what she can see.
 */
export function candidatesFrom(
  pool: readonly string[],
  rows: readonly { word: string; colors: readonly TileColor[] }[],
  hint: { letter: string; count: number } | null,
): string[] {
  return pool.filter((candidate) => {
    for (const row of rows) {
      if (!sameColors(computeFeedback(row.word, candidate).colors, row.colors)) return false;
    }
    if (hint && occurrences(candidate, hint.letter) !== hint.count) return false;
    return true;
  });
}

/**
 * `count` of `candidates`, drawn uniformly and without replacement by `random`.
 * Uniform on purpose: any preference here — for informative words, for common
 * ones — would be the game choosing for her.
 */
export function drawCandidates(
  candidates: readonly string[],
  count: number,
  random: () => number,
): string[] {
  if (candidates.length <= count) return [...candidates];
  const drawn = new Set<number>();
  while (drawn.size < count) drawn.add(Math.floor(random() * candidates.length));
  return [...drawn].map((i) => candidates[i]);
}
