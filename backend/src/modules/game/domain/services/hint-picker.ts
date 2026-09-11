import type { HintPick, PositionCharge } from '@modules/rooms/domain/entities/player-round.entity';

/**
 * Picks a random answer position the player has not turned green (nor been
 * hinted) and returns its letter plus that position. Null when nothing is left
 * to reveal. The position never leaves the server: it only feeds the time
 * ledger (no yellow seconds there, 5 s when it turns green); the player is
 * told the letter alone.
 */
export function pickHint(
  answer: string,
  charges: PositionCharge[],
  random: () => number = Math.random,
): HintPick | null {
  const candidates: number[] = [];
  charges.forEach((c, i) => {
    if (!c.green && !c.hinted) candidates.push(i);
  });
  if (candidates.length === 0) return null;
  const position = candidates[Math.floor(random() * candidates.length)];
  return { letter: answer[position], position };
}
