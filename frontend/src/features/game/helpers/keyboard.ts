import type { HintReveal, Language, OwnRow, TileColor } from '@/shared/contract';

import type { KeyState } from '../models/game.model';

export const ENTER_KEY = 'ENTER';
export const BACKSPACE_KEY = 'BACKSPACE';

const ROWS_ES = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];
const ROWS_EN = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** Rows of key labels; the last row is wrapped with ENTER / BACKSPACE by the component. */
export const keyboardRows = (language: Language): string[][] =>
  (language === 'es' ? ROWS_ES : ROWS_EN).map((row) => [...row]);

export const isLetterFor = (key: string, language: Language): boolean => {
  if (key.length !== 1) return false;
  const upper = key.toUpperCase();
  if (upper === 'Ñ') return language === 'es';
  return upper >= 'A' && upper <= 'Z';
};

const rank: Record<TileColor, number> = { gray: 1, yellow: 2, green: 3 };

/** Best colour reached per letter across the player's own rows; hint letter dashed unless already coloured. */
export const deriveKeyStates = (
  rows: OwnRow[],
  hint: HintReveal | null,
): Record<string, KeyState> => {
  const states: Record<string, KeyState> = {};
  for (const row of rows) {
    const letters = [...row.word.toUpperCase()];
    letters.forEach((letter, index) => {
      const color = row.colors[index];
      if (!color) return;
      const current = states[letter];
      if (!current || current === 'hint' || rank[color] > rank[current as TileColor]) {
        states[letter] = color;
      }
    });
  }
  if (hint) {
    const letter = hint.letter.toUpperCase();
    if (states[letter] !== 'green')
      states[letter] = states[letter] === 'yellow' ? 'yellow' : 'hint';
  }
  return states;
};

/** Distinct board positions that have been green at least once. */
export const countGreenPositions = (rows: OwnRow[]): number => {
  const positions = new Set<number>();
  for (const row of rows) {
    row.colors.forEach((color, index) => {
      if (color === 'green') positions.add(index);
    });
  }
  return positions.size;
};
