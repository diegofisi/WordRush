import { WORD_LENGTH } from '@shared/contract';
import { isWordShaped, normalizeWord } from '../../domain/services/normalize-word';
import { JsonWordListRepository } from './json-word-list.repository';

const repository = new JsonWordListRepository();

/** Exactly what `SubmitGuessUseCase` does before touching the ledger. */
const accepts = (language: 'es' | 'en', raw: string): boolean => {
  const word = normalizeWord(raw);
  return isWordShaped(word, WORD_LENGTH) && repository.isAllowed(language, word);
};

describe('JsonWordListRepository', () => {
  describe('the room language decides the list', () => {
    it.each(['cloud', 'party', 'house'])('rejects the English word "%s" in an es room', (word) => {
      expect(accepts('es', word)).toBe(false);
      expect(accepts('en', word)).toBe(true);
    });

    it.each(['carro', 'sueño', 'limon'])('accepts the Spanish word "%s" in an es room', (word) => {
      expect(accepts('es', word)).toBe(true);
    });

    it('accepts accents and case, which normalisation strips', () => {
      expect(accepts('es', ' LIMÓN ')).toBe(true);
      expect(accepts('es', 'SUEÑO')).toBe(true);
    });

    it('rejects Spanish words in an en room', () => {
      for (const word of ['carro', 'sueño', 'limon']) expect(accepts('en', word)).toBe(false);
    });
  });

  it('every answer is also an accepted guess', () => {
    for (const language of ['es', 'en'] as const) {
      const answers = repository.answers(language);
      expect(answers.length).toBeGreaterThan(0);
      for (const answer of answers) {
        expect(isWordShaped(answer, WORD_LENGTH)).toBe(true);
        expect(repository.isAllowed(language, answer)).toBe(true);
      }
    }
  });
});
