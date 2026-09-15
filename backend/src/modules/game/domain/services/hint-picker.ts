import type { HintPick, PositionCharge } from '@modules/rooms/domain/entities/player-round.entity';

/**
 * Picks what the hint reveals (docs/context/06-v1.1.md -> Hint). The ledger is
 * keyed by answer slot, so "what the player already knows" is read per slot: a
 * slot is known when it is green, charged yellow, or hinted.
 *
 * - While some slot is still unknown, the hint reveals a **new letter**: one
 *   of the unknown slots is drawn and its letter is told, position unsaid.
 *   With repeated letters this works per slot: on `LLAMA`, a player holding
 *   one yellow `L` can still be told the other `L`.
 * - Once every slot is known and at least one is not green, the hint
 *   **places** one of those: letter and position, and the slot turns green.
 *
 * Returns null only when every slot is already green. The slot never leaves
 * the server for a letter hint; it only feeds the time ledger.
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
  if (unknown.length > 0) {
    const position = unknown[Math.floor(random() * unknown.length)];
    return { letter: answer[position], position, kind: 'letter' };
  }
  if (known.length === 0) return null;
  const position = known[Math.floor(random() * known.length)];
  return { letter: answer[position], position, kind: 'position' };
}
