import {
  checkPhrase,
  checkWord,
  occurrences,
  parsePhrase,
  phraseLetters,
  phrasePercent,
} from './phrase';

describe('phrase', () => {
  const phrase = parsePhrase('Más vale  tarde que nunca');

  it('normalises like the word lists and keeps the word lengths', () => {
    expect(phrase.words).toEqual(['mas', 'vale', 'tarde', 'que', 'nunca']);
    expect(phrase.display).toBe('mas vale tarde que nunca');
    expect(phrase.total).toBe(20);
  });

  it('colours a typed word green where the letter is anywhere in the phrase', () => {
    const { colors, newLetters } = checkWord(phrase, 'canto', new Set());
    expect(colors).toEqual(['green', 'green', 'green', 'green', 'gray']);
    expect(newLetters).toEqual(['c', 'a', 'n', 't']);
  });

  it('counts every occurrence of a letter and reveals all of them', () => {
    expect(occurrences(phrase, 'a')).toBe(4);
    const found = new Set(['a']);
    expect(phraseLetters(phrase, found)).toEqual([
      [null, 'a', null],
      [null, 'a', null, null],
      [null, 'a', null, null, null],
      [null, null, null],
      [null, null, null, null, 'a'],
    ]);
    expect(phrasePercent(phrase, found)).toBe(20);
  });

  it('accepts the phrase whatever its accents or spacing, and marks the misses', () => {
    expect(checkPhrase(phrase, 'MÁS VALE   tarde que nunca').correct).toBe(true);
    const miss = checkPhrase(phrase, 'mas vale tarde que nunco');
    expect(miss.fits).toBe(true);
    expect(miss.correct).toBe(false);
    expect(miss.wrong[4]).toEqual([false, false, false, false, true]);
    expect(checkPhrase(phrase, 'mas vale tarde').fits).toBe(false);
  });
});
