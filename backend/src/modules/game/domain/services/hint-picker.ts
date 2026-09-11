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
 * yellow seconds there, 5 s when it turns green); the player is told the
 * letter alone.
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
  return { letter: answer[position], position };
}
