/**
 * What a player (or a team) has uncovered of the phrase this round
 * (docs/context/06-v1.1.md -> Guess the phrase): the letters found, the
 * failed sends and the words typed. The phrase itself lives on the room.
 * Plain data, so it could be serialized one day.
 */
export class PhraseProgress {
  readonly found = new Set<string>();
  /** Failed sends; the round ends for the owner at `PHRASE_RULES.sends`. */
  sendsUsed = 0;
  /** Words typed by the owner (every member's, for a team): the penalty base. */
  wordsSent = 0;
  completed = false;

  reveal(letters: readonly string[]): void {
    for (const letter of letters) this.found.add(letter);
  }
}
