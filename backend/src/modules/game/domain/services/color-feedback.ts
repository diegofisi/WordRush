import type { TileColor } from '@shared/contract';

export interface Feedback {
  colors: TileColor[];
  /**
   * For each guess index coloured yellow, the answer position that letter
   * accounts for (the ledger is keyed by answer position). Null otherwise.
   */
  yellowTargets: (number | null)[];
}

/**
 * Standard two-pass Wordle colouring: greens first, then each remaining guess
 * letter consumes the first unmatched occurrence in the answer (yellow), so
 * repeated letters are never over-credited.
 */
export function computeFeedback(guess: string, answer: string): Feedback {
  const n = answer.length;
  const colors: TileColor[] = new Array<TileColor>(n).fill('gray');
  const consumed = new Array<boolean>(n).fill(false);
  const yellowTargets = new Array<number | null>(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      colors[i] = 'green';
      consumed[i] = true;
    }
  }
  for (let i = 0; i < n; i++) {
    if (colors[i] === 'green') continue;
    for (let j = 0; j < n; j++) {
      if (!consumed[j] && answer[j] === guess[i]) {
        colors[i] = 'yellow';
        consumed[j] = true;
        yellowTargets[i] = j;
        break;
      }
    }
  }
  return { colors, yellowTargets };
}
