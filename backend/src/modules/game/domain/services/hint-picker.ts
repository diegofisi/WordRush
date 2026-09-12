import type { HintPick, PositionCharge } from '@modules/rooms/domain/entities/player-round.entity';

/**
 * Picks the answer position the hint reveals. The ledger is keyed by answer
 * slot, so "what the player already knows" is read per slot: a slot is known
 * when it is green, when it has been charged yellow, or when it was hinted.
 *
 * The hint prefers a slot the player does not know yet, so it never repeats a
 * letter they already have. With repeated letters this works per slot: on
 * `LLAMA`, a player holding one yellow `L` can still be hinted the other `L`
 * (they do not know the word has two); once both `L` slots are known, `L` can
 * no longer come out. When every non-green slot is already known, the hint
 * falls back to one of those known slots instead of failing — it is still a
 * real letter of the word, and the ledger is unaffected (a yellow slot is
 * already charged, so marking it hinted changes no seconds).
 *
 * Returns null only when there is nothing left at all (every slot green).
 * The position never leaves the server: it only feeds the time ledger (no
 * yellow seconds there, 5 s when it turns green). The player is told the
 * letter and how many times it occurs in the answer -- on `LLAMA` an `L`
 * comes with a count of 2 -- so the chip can read "Hay dos L en la palabra".
 */
export function pickHint(
  answer: string,
  charges: PositionCharge[],
  random: () => number = Math.random,
): HintPick | null {
  const unknown: number[] = [];
  const known: number[] = [];
  charges.forEach((c, i) => {
    if (c.green) return;
    if (c.yellow || c.hinted) known.push(i);
    else unknown.push(i);
  });
  const pool = unknown.length > 0 ? unknown : known;
  if (pool.length === 0) return null;
  const position = pool[Math.floor(random() * pool.length)];
  const letter = answer[position];
  return { letter, position, count: countLetter(answer, letter) };
}

/** How many times `letter` occurs in the answer. */
export function countLetter(answer: string, letter: string): number {
  let total = 0;
  for (const char of answer) if (char === letter) total += 1;
  return total;
}
