import { type IWordList } from '../../domain/interfaces/word-list.interface';
import { biasedIndex, RandomWordPicker } from './random-word.picker';

const answers = Array.from({ length: 100 }, (_, i) => `w${String(i).padStart(3, '0')}`);
const wordList: IWordList = {
  answers: () => answers,
  isAllowed: () => true,
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md): `guessable`.
  guessable: () => answers,
};

describe('biasedIndex', () => {
  it('maps the uniform draw to the head of the list', () => {
    expect(biasedIndex(0, 100)).toBe(0);
    expect(biasedIndex(0.5, 100)).toBe(25);
    expect(biasedIndex(0.9, 100)).toBe(81);
    expect(biasedIndex(0.999999, 100)).toBe(99);
  });

  it('never leaves the list bounds', () => {
    expect(biasedIndex(1, 100)).toBe(99);
    expect(biasedIndex(-1, 100)).toBe(0);
    expect(biasedIndex(0.7, 1)).toBe(0);
  });
});

describe('RandomWordPicker', () => {
  it('favours common words: half of the picks land in the first quarter', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const picker = new RandomWordPicker(wordList, rng);
    const picks = Array.from({ length: 4000 }, () => picker.pick('es', 5, new Set()));
    const inFirstQuarter = picks.filter((w) => answers.indexOf(w) < 25).length / picks.length;
    const inFirstTenth = picks.filter((w) => answers.indexOf(w) < 10).length / picks.length;
    expect(inFirstQuarter).toBeGreaterThan(0.45);
    expect(inFirstQuarter).toBeLessThan(0.55);
    expect(inFirstTenth).toBeGreaterThan(0.27);
    expect(picks.some((w) => answers.indexOf(w) >= 75)).toBe(true);
  });

  it('skips excluded words and keeps the ranking of the rest', () => {
    const picker = new RandomWordPicker(wordList, () => 0);
    expect(picker.pick('es', 5, new Set(['w000', 'w001']))).toBe('w002');
  });

  it('falls back to the full list when everything is excluded', () => {
    const picker = new RandomWordPicker(wordList, () => 0);
    expect(picker.pick('es', 5, new Set(answers))).toBe('w000');
  });
});
