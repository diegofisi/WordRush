import { describe, expect, it } from 'vitest';

import type { OwnRow } from '@/shared/contract';

import { countGreenPositions, deriveKeyStates, isLetterFor, keyboardRows } from './keyboard';

const row = (word: string, colors: OwnRow['colors']): OwnRow => ({ word, colors });

describe('keyboardRows', () => {
  it('gives a Spanish room its Ñ and an English one none', () => {
    expect(keyboardRows('es')[1]).toContain('Ñ');
    expect(keyboardRows('en').flat()).not.toContain('Ñ');
  });
});

describe('isLetterFor', () => {
  it('accepts Ñ only in a Spanish room', () => {
    expect(isLetterFor('ñ', 'es')).toBe(true);
    expect(isLetterFor('ñ', 'en')).toBe(false);
  });

  it('rejects anything that is not a single letter', () => {
    expect(isLetterFor('Enter', 'es')).toBe(false);
    expect(isLetterFor('1', 'es')).toBe(false);
    expect(isLetterFor('', 'es')).toBe(false);
  });
});

describe('deriveKeyStates', () => {
  it('keeps the best colour a letter ever reached', () => {
    const states = deriveKeyStates(
      [
        row('CASAS', ['yellow', 'gray', 'gray', 'gray', 'gray']),
        row('CERCA', ['green', 'gray', 'gray', 'gray', 'gray']),
      ],
      null,
    );
    // A later green must win over the earlier yellow for the same letter.
    expect(states['C']).toBe('green');
  });

  it('never lets a later grey undo a colour already earned', () => {
    const states = deriveKeyStates(
      [
        row('LLAMA', ['green', 'gray', 'gray', 'gray', 'gray']),
        row('LOTES', ['gray', 'gray', 'gray', 'gray', 'gray']),
      ],
      null,
    );
    expect(states['L']).toBe('green');
  });

  it('marks a hinted letter that has not been tried', () => {
    const states = deriveKeyStates([], { letter: 'M', kind: 'letter', position: null });
    expect(states['M']).toBe('hint');
  });

  it('does not downgrade a green or a yellow to the hint style', () => {
    const green = deriveKeyStates([row('MESAS', ['green', 'gray', 'gray', 'gray', 'gray'])], {
      letter: 'M',
      kind: 'letter',
      position: null,
    });
    expect(green['M']).toBe('green');

    const yellow = deriveKeyStates([row('AMIGO', ['gray', 'yellow', 'gray', 'gray', 'gray'])], {
      letter: 'M',
      kind: 'letter',
      position: null,
    });
    expect(yellow['M']).toBe('yellow');
  });

  it('reads the guess case-insensitively', () => {
    const states = deriveKeyStates([row('casas', ['green', 'gray', 'gray', 'gray', 'gray'])], null);
    expect(states['C']).toBe('green');
  });
});

describe('countGreenPositions', () => {
  it('counts board positions, not how often they came up green', () => {
    const count = countGreenPositions([
      row('CASAS', ['green', 'gray', 'gray', 'gray', 'gray']),
      row('CERCA', ['green', 'gray', 'gray', 'gray', 'green']),
    ]);
    // Position 0 twice and position 4 once = two distinct positions.
    expect(count).toBe(2);
  });

  it('is zero for an untouched board', () => {
    expect(countGreenPositions([])).toBe(0);
  });
});
