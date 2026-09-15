import { Injectable } from '@nestjs/common';
import { WORD_LENGTHS, type Language, type WordLength } from '@shared/contract';
import { IWordList } from '../../domain/interfaces/word-list.interface';
import enData from '../../data/en.json';
import en6Data from '../../data/en6.json';
import en7Data from '../../data/en7.json';
import esData from '../../data/es.json';
import es6Data from '../../data/es6.json';
import es7Data from '../../data/es7.json';

interface WordData {
  language: string;
  answers: string[];
  allowed: string[];
}

interface LoadedList {
  answers: readonly string[];
  allowed: ReadonlySet<string>;
}

/** One file per language and length; 5 letters keeps the original file name. */
const SOURCES: Record<Language, Record<WordLength, WordData>> = {
  es: { 5: esData, 6: es6Data, 7: es7Data },
  en: { 5: enData, 6: en6Data, 7: en7Data },
};

@Injectable()
export class JsonWordListRepository implements IWordList {
  private readonly lists: Record<Language, Record<WordLength, LoadedList>>;

  constructor() {
    const load = (language: Language) =>
      Object.fromEntries(
        WORD_LENGTHS.map((length) => [
          length,
          JsonWordListRepository.load(SOURCES[language][length]),
        ]),
      ) as Record<WordLength, LoadedList>;
    this.lists = { es: load('es'), en: load('en') };
  }

  private static load(data: WordData): LoadedList {
    // `allowed` is documented as a superset of `answers`; union to be safe.
    const allowed = new Set<string>([...data.allowed, ...data.answers]);
    return { answers: Object.freeze([...data.answers]), allowed };
  }

  isAllowed(language: Language, word: string): boolean {
    const list = this.lists[language][word.length as WordLength];
    return list ? list.allowed.has(word) : false;
  }

  answers(language: Language, length: WordLength): readonly string[] {
    return this.lists[language][length].answers;
  }
}
