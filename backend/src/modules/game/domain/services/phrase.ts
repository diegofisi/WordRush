import type { PhraseLetters, PhraseMask, TileColor } from '@shared/contract';
import { normalizeWord } from '@modules/words/domain/services/normalize-word';

/**
 * A phrase of the second game (docs/context/06-v1.1.md -> Guess the phrase),
 * in the same canonical form as the word lists: lowercase, accents stripped,
 * `ñ` kept, one space between words.
 */
export interface ParsedPhrase {
  /** As shown when the round ends. */
  display: string;
  /** Canonical words. */
  words: string[];
  /** Letters in the whole phrase. */
  total: number;
}

export function parsePhrase(text: string): ParsedPhrase {
  const words = text
    .split(/\s+/)
    .map((word) => normalizeWord(word))
    .filter((word) => word.length > 0);
  return { display: words.join(' '), words, total: words.join('').length };
}

/** The lengths of the words: public from the first second. */
export const phraseShape = (phrase: ParsedPhrase): number[] => phrase.words.map((w) => w.length);

/** How many times `letter` occurs in the whole phrase. */
export function occurrences(phrase: ParsedPhrase, letter: string): number {
  let count = 0;
  for (const word of phrase.words) for (const ch of word) if (ch === letter) count += 1;
  return count;
}

/** Occurrences of every found letter; the "N of M letters" figure. */
export function foundCount(phrase: ParsedPhrase, found: ReadonlySet<string>): number {
  let count = 0;
  for (const word of phrase.words) for (const ch of word) if (found.has(ch)) count += 1;
  return count;
}

export function phraseLetters(phrase: ParsedPhrase, found: ReadonlySet<string>): PhraseLetters {
  return phrase.words.map((word) => [...word].map((ch) => (found.has(ch) ? ch : null)));
}

export function phraseMask(phrase: ParsedPhrase, found: ReadonlySet<string>): PhraseMask {
  return phrase.words.map((word) => [...word].map((ch) => found.has(ch)));
}

export function phrasePercent(phrase: ParsedPhrase, found: ReadonlySet<string>): number {
  if (phrase.total === 0) return 0;
  return Math.round((foundCount(phrase, found) / phrase.total) * 100);
}

/**
 * Feedback of a typed word against the phrase: green where the letter is
 * anywhere in the phrase, grey otherwise. Returns the colours and the letters
 * newly found (each once, in the order they appear in the word).
 */
export function checkWord(
  phrase: ParsedPhrase,
  word: string,
  found: ReadonlySet<string>,
): { colors: TileColor[]; newLetters: string[] } {
  const inPhrase = new Set(phrase.words.join(''));
  const colors: TileColor[] = [];
  const newLetters: string[] = [];
  const seen = new Set<string>();
  for (const ch of word) {
    if (inPhrase.has(ch)) {
      colors.push('green');
      if (!found.has(ch) && !seen.has(ch)) {
        seen.add(ch);
        newLetters.push(ch);
      }
    } else {
      colors.push('gray');
    }
  }
  return { colors, newLetters };
}

/**
 * One try at the whole phrase. The text must have the phrase's words with
 * their lengths (`fits` false otherwise); `wrong` marks, per word and letter,
 * where the sent letter differs — the red letters of the modal.
 */
export function checkPhrase(
  phrase: ParsedPhrase,
  text: string,
): { fits: boolean; correct: boolean; wrong: boolean[][] } {
  const sent = parsePhrase(text).words;
  const fits =
    sent.length === phrase.words.length &&
    sent.every((word, index) => word.length === phrase.words[index].length);
  if (!fits)
    return { fits, correct: false, wrong: phrase.words.map((w) => [...w].map(() => true)) };
  const wrong = phrase.words.map((word, index) =>
    [...word].map((ch, at) => sent[index][at] !== ch),
  );
  return { fits, correct: wrong.every((word) => word.every((w) => !w)), wrong };
}
