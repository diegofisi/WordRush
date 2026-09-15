import type { Language } from '@shared/contract';

export const PHRASE_BANK = Symbol('PHRASE_BANK');

/** Picks the phrase of a round (docs/context/06-v1.1.md -> Guess the phrase). */
export interface IPhraseBank {
  pick(language: Language, exclude: ReadonlySet<string>): string;
}
