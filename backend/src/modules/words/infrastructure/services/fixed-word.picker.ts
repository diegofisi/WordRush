import { Logger } from '@nestjs/common';
import type { Language, WordLength } from '@shared/contract';
import type { IWordList } from '../../domain/interfaces/word-list.interface';
import type { IWordPicker } from '../../domain/interfaces/word-picker.interface';

/**
 * Testing-only picker: returns the same answer every round so a scripted game
 * can be played to the end. Installed by `WordsModule` only when
 * `resolveFixedWord` accepts the environment (never in production).
 */
export class FixedWordPicker implements IWordPicker {
  private readonly logger = new Logger(FixedWordPicker.name);

  constructor(
    private readonly word: string,
    private readonly wordList: IWordList,
    private readonly fallback: IWordPicker,
  ) {}

  pick(language: Language, length: WordLength, exclude: ReadonlySet<string>): string {
    if (this.word.length === length && this.wordList.isAllowed(language, this.word)) {
      return this.word;
    }
    this.logger.warn(
      `WORDRUSH_FIXED_WORD="${this.word}" is not a ${language} word of ${length} letters; falling back to a random answer`,
    );
    return this.fallback.pick(language, length, exclude);
  }
}
