import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { computeFeedback } from './color-feedback';
import { pickHint } from './hint-picker';
import { chargeGuess } from './time-ledger';

/** Plays a guess through the ledger so the charges match a real round. */
function play(round: PlayerRound, guess: string, answer: string): void {
  chargeGuess(round.charges, guess, computeFeedback(guess, answer));
}

/** Every letter the hint can come out with, over all random draws. */
function possibleLetters(answer: string, round: PlayerRound): Set<string> {
  const letters = new Set<string>();
  for (let i = 0; i < round.charges.length; i++) {
    const pick = pickHint(answer, round.charges, () => i / round.charges.length);
    if (pick) letters.add(pick.letter);
  }
  return letters;
}

describe('pickHint', () => {
  it('never reveals a letter the player already holds in yellow', () => {
    const answer = 'plato'; // no repeated letters
    const round = new PlayerRound(0, 90);
    play(round, 'tapes', answer); // T, A and P yellow; E and S absent
    expect(round.charges.filter((c) => c.yellow)).toHaveLength(3);

    const letters = possibleLetters(answer, round);
    expect(letters).toEqual(new Set(['l', 'o']));
  });

  it('still offers the second slot of a repeated letter', () => {
    const answer = 'llama'; // L L A M A
    const round = new PlayerRound(0, 90);
    play(round, 'salto', answer); // one L yellow and one A yellow, one slot each
    expect(round.charges.filter((c) => c.yellow)).toHaveLength(2);

    const letters = possibleLetters(answer, round);
    // The player knows one L and one A, not that there are two of each.
    expect(letters).toEqual(new Set(['l', 'a', 'm']));

    // Once both L slots are known, L can no longer come out.
    round.charges[0].yellow = true;
    round.charges[1].yellow = true;
    expect(possibleLetters(answer, round).has('l')).toBe(false);
  });

  it('falls back to a known letter when every non-green slot is known', () => {
    const answer = 'plato';
    const round = new PlayerRound(0, 90);
    round.charges[0].green = true; // P placed
    for (let i = 1; i < round.charges.length; i++) round.charges[i].yellow = true;

    const pick = pickHint(answer, round.charges, () => 0);
    expect(pick).not.toBeNull();
    expect(pick?.position ?? 0).toBeGreaterThan(0); // never the green slot
    expect(possibleLetters(answer, round)).toEqual(new Set(['l', 'a', 't', 'o']));
  });

  it('never reveals a green slot and returns null when all of them are green', () => {
    const answer = 'plato';
    const round = new PlayerRound(0, 90);
    play(round, 'plata', answer); // P L A T green, last slot still unknown
    expect(round.greens).toBe(4);

    expect(possibleLetters(answer, round)).toEqual(new Set(['o']));

    round.charges[4].green = true;
    expect(pickHint(answer, round.charges, () => 0)).toBeNull();
  });
});
