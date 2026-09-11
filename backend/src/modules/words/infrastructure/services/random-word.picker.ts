import { Inject, Injectable } from '@nestjs/common';
import type { Language } from '@shared/contract';
import { IWordList, WORD_LIST } from '../../domain/interfaces/word-list.interface';
import { IWordPicker } from '../../domain/interfaces/word-picker.interface';

/**
 * Exponent of the head bias. Answer lists are sorted from most to least
 * common, and the pick index is `floor(n * r ** HEAD_BIAS)` with `r` uniform in
 * [0, 1). With 2 the first tenth of the list receives about a third of the
 * picks and the first quarter about half, so the everyday words show up most
 * while the tail still appears now and then.
 */
export const HEAD_BIAS = 2;

/** Picks a random answer, favouring the most common words (the head of the list). */
@Injectable()
export class RandomWordPicker implements IWordPicker {
  constructor(
    @Inject(WORD_LIST) private readonly wordList: IWordList,
    private readonly rng: () => number = Math.random,
  ) {}

  pick(language: Language, exclude: ReadonlySet<string>): string {
    const answers = this.wordList.answers(language);
    const candidates = answers.filter((w) => !exclude.has(w));
    const pool = candidates.length > 0 ? candidates : answers;
    return pool[biasedIndex(this.rng(), pool.length)];
  }
}

/** Maps a uniform `r` in [0, 1) to an index in [0, size) skewed towards 0. */
export function biasedIndex(r: number, size: number): number {
  const clamped = Math.min(Math.max(r, 0), 1 - Number.EPSILON);
  return Math.min(size - 1, Math.floor(size * clamped ** HEAD_BIAS));
}
