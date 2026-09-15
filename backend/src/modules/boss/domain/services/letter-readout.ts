import { WORD_LENGTH } from '@shared/contract';

/**
 * The trained half of the fly: descending firing rates in, a wanted-letter map
 * out. It is the only thing here that was fitted to anything; the connectome
 * upstream of it is fixed anatomy.
 *
 * She does not pick a word from a list. Her brain says which letters it wants,
 * and the board plays the legal word that best matches — the same division a
 * chess engine makes between generating legal moves and choosing one.
 */

/** Spanish keyboard, the game's own alphabet. */
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyzñ';
export const LETTERS = ALPHABET.length;

/**
 * One output past the alphabet: "spend the hint now".
 *
 * The hint is part of the game's rules, so she gets one like anybody else — but
 * *when* to spend it is a judgement, and a judgement made by a threshold I wrote
 * would be the policy coming back in through the side door. So it is a unit of
 * the readout, fitted like the letters are, and she has to learn to read her own
 * position well enough to ask (docs/context/06-boss-mode.md).
 *
 * Asking is not getting: the room decides whether hints exist at all, and she
 * only has one. Her brain presses the button; the rules answer.
 */
export const HINT_OUTPUT = LETTERS;
export const OUTPUTS = LETTERS + 1;

export interface ReadoutWeights {
  /** Descending cells the readout was trained on. */
  inputs: number;
  /** Per-input standardisation, measured on the training set. */
  mean: number[];
  sd: number[];
  /** OUTPUTS x inputs, row-major. One weight per descending cell per output. */
  w: number[];
  b: number[];
  /** Provenance, written by the trainer. */
  trainedAt: string;
  samples: number;
  heldOutError: number;
  /** Error of a readout that ignored the brain. The gap is the brain's worth. */
  flatError: number;
  /** The ridge penalty kept, chosen on held-out error. */
  lambda: number;
}

/**
 * The trained half of the fly: descending firing rates in, a wanted-letter map
 * out. One matrix, fitted by ridge regression.
 *
 * It was a 1,299 -> 24 -> 28 network until 2026-09-13, and that was too much
 * machine for the job: 31,176 weights against 960 training boards memorised them
 * (training error 0.13, held-out 0.37) and ended up worse than answering with a
 * constant. A plain linear map with the penalty swept on held-out data reaches
 * 21.6% better than that constant on the same data. Less readout is also the
 * point: the fewer parameters sit between her spikes and the letters, the less
 * room there is for something other than the fly to be doing the playing.
 */
export class LetterReadout {
  private readonly out: Float32Array;
  readonly preference: Float32Array;
  /**
   * What the board changed, per letter: her output minus what she says on an
   * average board.
   *
   * This is the number the word choice has to use, and using the raw preference
   * instead is what made the silencing control come out at 1 round in 30 played
   * differently. Her output for a letter is its frequency in Spanish plus a
   * small board-dependent shift — the A scores high on every board because the A
   * is in a third of all words. Summed over five letters and maximised across
   * 10,835 of them, the frequency part swamps the board part and the same word
   * wins every time, brain or no brain. Subtracting the baseline leaves only
   * what she actually read off this board (docs/context/06-boss-mode.md).
   */
  readonly wanted: Float32Array;

  constructor(private readonly weights: ReadoutWeights) {
    this.out = new Float32Array(OUTPUTS);
    this.preference = this.out.subarray(0, LETTERS);
    this.wanted = new Float32Array(LETTERS);
  }

  /** How much she wants to spend her hint on this board, 0..1. */
  get hintWant(): number {
    return this.out[HINT_OUTPUT];
  }

  get provenance(): { trainedAt: string; samples: number; heldOutError: number } {
    const { trainedAt, samples, heldOutError } = this.weights;
    return { trainedAt, samples, heldOutError };
  }

  /** Descending rates in Hz -> a preference in 0..1 per letter, plus the hint. */
  run(rates: Float32Array): Float32Array {
    const { inputs, mean, sd, w, b } = this.weights;
    for (let k = 0; k < OUTPUTS; k += 1) {
      let sum = b[k];
      const row = k * inputs;
      for (let d = 0; d < inputs; d += 1) sum += w[row + d] * ((rates[d] - mean[d]) / sd[d]);
      // The targets are 0 or 1, so the fit is clipped rather than squashed: a
      // sigmoid here would be a second, untrained nonlinearity on top.
      this.out[k] = sum < 0 ? 0 : sum > 1 ? 1 : sum;
    }
    // `b` is the training mean of each output: what she says about a letter
    // before the board says anything.
    for (let l = 0; l < LETTERS; l += 1) this.wanted[l] = this.out[l] - b[l];
    return this.preference;
  }
}

/**
 * How well a word matches what her brain asked for: for every distinct letter it
 * spends, how much more than usual she wants it on this board. Pass
 * `readout.wanted`, not `readout.preference` — see the note on that field.
 *
 * Letters she had already placed used to be discounted to 35 %, which sounds
 * reasonable and was a hand-tuned thumb on the scale — a rule about how to play
 * Wordle, applied on top of what the brain asked for. If she should stop
 * spending letters she already knows, her readout has to learn to stop asking
 * for them (docs/context/06-boss-mode.md, 2026-09-13).
 */
export function scoreWord(word: string, wanted: Float32Array): number {
  const seen = new Set<string>();
  let score = 0;
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    const letter = word[i];
    if (seen.has(letter)) continue;
    seen.add(letter);
    const index = ALPHABET.indexOf(letter);
    if (index < 0) continue;
    score += wanted[index];
  }
  return score;
}

/**
 * What a good player would want next: how evenly each letter splits the answers
 * still standing. A letter in half of them is worth most; one in all or none of
 * them tells you nothing. This is the target the readout is fitted to.
 */
export function informativeLetters(candidates: readonly string[]): Float32Array {
  const target = new Float32Array(LETTERS);
  if (candidates.length === 0) return target;
  const counts = new Float32Array(LETTERS);
  for (const word of candidates) {
    const seen = new Set<string>();
    for (const letter of word) {
      if (seen.has(letter)) continue;
      seen.add(letter);
      const index = ALPHABET.indexOf(letter);
      if (index >= 0) counts[index] += 1;
    }
  }
  for (let l = 0; l < LETTERS; l += 1) {
    const share = counts[l] / candidates.length;
    // Peaks at a half-and-half split, zero at "in none" and "in all".
    target[l] = 1 - Math.abs(share - 0.5) * 2;
  }
  return target;
}
