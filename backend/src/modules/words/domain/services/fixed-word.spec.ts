import { resolveFixedWord } from './fixed-word';

describe('resolveFixedWord', () => {
  it('returns the normalised word outside production', () => {
    expect(resolveFixedWord({ WORDRUSH_FIXED_WORD: 'AHORA' })).toBe('ahora');
    expect(resolveFixedWord({ NODE_ENV: 'development', WORDRUSH_FIXED_WORD: ' Solid ' })).toBe(
      'solid',
    );
    expect(resolveFixedWord({ NODE_ENV: 'test', WORDRUSH_FIXED_WORD: 'limón' })).toBe('limon');
  });

  it('is inert in production even when the variable is set', () => {
    expect(resolveFixedWord({ NODE_ENV: 'production', WORDRUSH_FIXED_WORD: 'ahora' })).toBeNull();
  });

  it('returns null when unset or not a 5-, 6- or 7-letter word', () => {
    expect(resolveFixedWord({})).toBeNull();
    expect(resolveFixedWord({ WORDRUSH_FIXED_WORD: '' })).toBeNull();
    expect(resolveFixedWord({ WORDRUSH_FIXED_WORD: 'sol' })).toBeNull();
    expect(resolveFixedWord({ WORDRUSH_FIXED_WORD: 'solidify' })).toBeNull();
    expect(resolveFixedWord({ WORDRUSH_FIXED_WORD: 'solids' })).toBe('solids');
    expect(resolveFixedWord({ WORDRUSH_FIXED_WORD: 'sol1d' })).toBeNull();
  });
});
