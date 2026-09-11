import { Injectable } from '@nestjs/common';
import type { Language } from '@shared/contract';
import { IWordList } from '../../domain/interfaces/word-list.interface';
import enData from '../../data/en.json';
import esData from '../../data/es.json';

interface WordData {
  language: string;
  answers: string[];
  allowed: string[];
}

interface LoadedList {
  answers: readonly string[];
  allowed: ReadonlySet<string>;
}

const SOURCES: Record<Language, WordData> = { es: esData, en: enData };

@Injectable()
export class JsonWordListRepository implements IWordList {
  private readonly lists: Record<Language, LoadedList>;

  constructor() {
    this.lists = {
      es: JsonWordListRepository.load(SOURCES.es),
      en: JsonWordListRepository.load(SOURCES.en),
    };
  }

  private static load(data: WordData): LoadedList {
    // `allowed` is documented as a superset of `answers`; union to be safe.
    const allowed = new Set<string>([...data.allowed, ...data.answers]);
    return { answers: Object.freeze([...data.answers]), allowed };
  }

  isAllowed(language: Language, word: string): boolean {
    return this.lists[language].allowed.has(word);
  }

  answers(language: Language): readonly string[] {
    return this.lists[language].answers;
  }
}
