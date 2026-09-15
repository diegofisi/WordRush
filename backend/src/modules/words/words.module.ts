import { Logger, Module } from '@nestjs/common';
import { resolveFixedWord } from './domain/services/fixed-word';
import { IWordList, WORD_LIST } from './domain/interfaces/word-list.interface';
import { PHRASE_BANK } from './domain/interfaces/phrase-bank.interface';
import { JsonPhraseBank } from './infrastructure/repositories/json-phrase-bank.repository';
import { IWordPicker, WORD_PICKER } from './domain/interfaces/word-picker.interface';
import { JsonWordListRepository } from './infrastructure/repositories/json-word-list.repository';
import { FixedWordPicker } from './infrastructure/services/fixed-word.picker';
import { RandomWordPicker } from './infrastructure/services/random-word.picker';

/** See `backend/README.md` -> Testing for the WORDRUSH_FIXED_WORD hook. */
function createWordPicker(wordList: IWordList): IWordPicker {
  const random = new RandomWordPicker(wordList);
  const fixed = resolveFixedWord(process.env);
  if (!fixed) return random;
  new Logger('WordsModule').warn(`Testing hook active: every round answers "${fixed}"`);
  return new FixedWordPicker(fixed, wordList, random);
}

@Module({
  providers: [
    { provide: WORD_LIST, useClass: JsonWordListRepository },
    { provide: WORD_PICKER, inject: [WORD_LIST], useFactory: createWordPicker },
    { provide: PHRASE_BANK, useClass: JsonPhraseBank },
  ],
  exports: [WORD_LIST, WORD_PICKER, PHRASE_BANK],
})
export class WordsModule {}
