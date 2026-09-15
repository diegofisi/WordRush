import { Injectable } from '@nestjs/common';
import type { Language } from '@shared/contract';
import { IPhraseBank } from '../../domain/interfaces/phrase-bank.interface';
import enData from '../../data/phrases.en.json';
import esData from '../../data/phrases.es.json';

interface PhraseData {
  language: string;
  phrases: string[];
}

const SOURCES: Record<Language, PhraseData> = { es: esData, en: enData };

/** The curated banks from `scripts/build-phrases.mjs`, picked uniformly at random. */
@Injectable()
export class JsonPhraseBank implements IPhraseBank {
  /** Swapped in tests; a constructor argument would look like a dependency to Nest. */
  rng: () => number = Math.random;

  pick(language: Language, exclude: ReadonlySet<string>): string {
    const all = SOURCES[language].phrases;
    const candidates = all.filter((phrase) => !exclude.has(phrase));
    const pool = candidates.length > 0 ? candidates : all;
    return pool[Math.min(pool.length - 1, Math.floor(this.rng() * pool.length))];
  }
}
