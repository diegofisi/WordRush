import { maskProfanity } from './profanity-filter';

describe('maskProfanity', () => {
  it('masks a blocked word whatever its case or accents', () => {
    expect(maskProfanity('eres un MARICÓN')).toBe('eres un *******');
  });

  it('leaves ordinary words and substrings alone', () => {
    expect(maskProfanity('la clase de Nigeria fue buena')).toBe('la clase de Nigeria fue buena');
  });

  it('masks every hit in a sentence and keeps the punctuation', () => {
    expect(maskProfanity('fag, fags!')).toBe('***, ****!');
  });
});
