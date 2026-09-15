import type { Language, WordLength } from '@shared/contract';

export const WORD_PICKER = Symbol('WORD_PICKER');

/** Chooses the answer for a round. Swapped for a seeded picker in tests. */
export interface IWordPicker {
  pick(language: Language, length: WordLength, exclude: ReadonlySet<string>): string;
}
