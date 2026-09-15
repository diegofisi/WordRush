/**
 * The offensive-word filter the word lists already use (`scripts/build-words.mjs`
 * -> BLOCK), applied to chat text: every hit is masked, the message still goes
 * through. Matching ignores case and accents and only hits whole words, so
 * "class" or "Nigeria" are left alone.
 */
const BLOCKED = [
  // from scripts/build-words.mjs BLOCK
  'nigga',
  'nigger',
  'faggot',
  'spick',
  'kikes',
  'gooks',
  'dykes',
  'fagot',
  'faggy',
  'chink',
  'wetback',
  'maric',
  'sudac',
  // the same slurs at chat length
  'niggas',
  'niggers',
  'faggots',
  'fag',
  'fags',
  'kike',
  'gook',
  'dyke',
  'chinks',
  'wetbacks',
  'marica',
  'maricas',
  'maricon',
  'maricones',
  'sudaca',
  'sudacas',
];

const strip = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const BLOCKED_SET = new Set(BLOCKED.map(strip));

/** Masks every blocked word with asterisks of the same length. */
export function maskProfanity(text: string): string {
  return text.replace(/[\p{L}\p{N}]+/gu, (word) =>
    BLOCKED_SET.has(strip(word)) ? '*'.repeat(word.length) : word,
  );
}
