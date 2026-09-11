import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { computeFeedback } from './color-feedback';
import { chargeGuess, totalSeconds } from './time-ledger';

const ANSWER = 'solid';

function play(round: PlayerRound, guess: string) {
  const gains = chargeGuess(round.charges, guess, computeFeedback(guess, ANSWER));
  return { gains, seconds: totalSeconds(gains) };
}

describe('chargeGuess (time ledger)', () => {
  let round: PlayerRound;

  beforeEach(() => {
    round = new PlayerRound(0, 90);
  });

  it('reproduces the simulation in 03-sistema-de-puntuacion.md (Ana)', () => {
    expect(play(round, 'sandy').seconds).toBe(15); // S green +10, D yellow +5
    expect(play(round, 'slide').seconds).toBe(10); // L +5, I +5, D again 0, S again 0
    const last = play(round, 'solid');
    expect(last.seconds).toBe(25); // O +10, L/I/D green after yellow +5 each, S 0
    expect(last.gains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ letter: 'o', kind: 'green', seconds: 10 }),
        expect.objectContaining({ letter: 'l', kind: 'green-after-yellow', seconds: 5 }),
        expect.objectContaining({ letter: 'i', kind: 'green-after-yellow', seconds: 5 }),
        expect.objectContaining({ letter: 'd', kind: 'green-after-yellow', seconds: 5 }),
      ]),
    );
    expect(round.greens).toBe(5);
  });

  it('pays 10 in total for yellow then green on the same position', () => {
    const first = play(round, 'sandy'); // D yellow (+5) for answer position 4
    expect(first.gains).toContainEqual({ letter: 'd', position: 3, kind: 'yellow', seconds: 5 });
    const second = play(round, 'solid');
    const d = second.gains.find((g) => g.letter === 'd');
    expect(d).toEqual({ letter: 'd', position: 4, kind: 'green-after-yellow', seconds: 5 });
  });

  it('pays 10 for a direct green', () => {
    const { gains } = play(round, 'sandy');
    expect(gains).toContainEqual({ letter: 's', position: 0, kind: 'green', seconds: 10 });
  });

  it('pays nothing for the yellow and 5 for the green of a hinted position', () => {
    round.revealHint({ letter: 'o', position: 1 });
    // O at guess index 0 is yellow and accounts for answer position 1 (hinted): 0 s.
    const yellowTry = play(round, 'ovals');
    expect(yellowTry.gains.find((g) => g.letter === 'o')).toBeUndefined();
    const greenTry = play(round, 'solid');
    expect(greenTry.gains.find((g) => g.letter === 'o')).toEqual({
      letter: 'o',
      position: 1,
      kind: 'green-after-hint',
      seconds: 5,
    });
  });

  it('pays nothing for repeating an already charged colour', () => {
    play(round, 'slide');
    expect(play(round, 'slide').seconds).toBe(0);
    play(round, 'solid');
    expect(play(round, 'solid').seconds).toBe(0);
  });

  it('caps a full round at 50 seconds', () => {
    expect(play(round, 'solid').seconds).toBe(50);
  });
});
