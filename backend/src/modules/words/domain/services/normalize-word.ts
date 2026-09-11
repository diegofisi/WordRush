/**
 * Canonical form of a guess: trimmed, lowercase, accents stripped, `ñ` kept.
 * "limón" -> "limon", "PIÑA" -> "piña". Word lists are stored in this form.
 */
export function normalizeWord(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .normalize('NFD')
      // NFD splits ñ into n + U+0303; restore it before stripping the other marks.
      .replace(/n\u0303/g, 'ñ')
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFC')
  );
}

const WORD_SHAPE = /^[a-zñ]+$/;

export function isWordShaped(word: string, length: number): boolean {
  return word.length === length && WORD_SHAPE.test(word);
}
