import { isWordShaped, normalizeWord } from './normalize-word';

describe('normalizeWord', () => {
  it('strips accents', () => {
    expect(normalizeWord('limón')).toBe('limon');
    expect(normalizeWord('árbol')).toBe('arbol');
    expect(normalizeWord('pingüe')).toBe('pingue');
  });

  it('preserves ñ, also when it arrives decomposed or uppercase', () => {
    expect(normalizeWord('ñandú')).toBe('ñandu');
    expect(normalizeWord('PIÑA')).toBe('piña');
    expect(normalizeWord('piña')).toBe('piña');
  });

  it('trims and lowercases', () => {
    expect(normalizeWord('  SOLID ')).toBe('solid');
  });
});

describe('isWordShaped', () => {
  it('accepts five lowercase letters including ñ', () => {
    expect(isWordShaped('solid', 5)).toBe(true);
    expect(isWordShaped('ñandu', 5)).toBe(true);
  });

  it('rejects wrong length, digits, spaces and leftover symbols', () => {
    expect(isWordShaped('soli', 5)).toBe(false);
    expect(isWordShaped('solids', 5)).toBe(false);
    expect(isWordShaped('sol1d', 5)).toBe(false);
    expect(isWordShaped('so id', 5)).toBe(false);
  });
});
