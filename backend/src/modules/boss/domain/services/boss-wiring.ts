import { BOSS } from '@shared/contract';
import { ALPHABET, LETTERS } from './letter-readout';
import { neuronsOfClass, type Connectome } from './connectome';
import type { StimulusChannel } from './lif-network';

/** Her board is five slots wide; the readout was trained on one. */
const WORD_LENGTH = BOSS.wordLength;

/**
 * Where the game touches the brain.
 *
 * Input goes into real sensory populations, one per thing she can see: the
 * colour of each board position, plus how boxed in she is. Output is read from
 * real descending neurons, the cells that in a fly carry decisions out of the
 * brain towards the body. Nothing here is invented anatomy; the populations are
 * selected from the FlyWire class annotations.
 */

/** Colours she can see in a slot, plus "nothing known yet". */
export const SLOT_STATES = ['green', 'yellow', 'gray', 'unknown'] as const;
export type SlotState = (typeof SLOT_STATES)[number];

/**
 * Firing rate injected for each state, in Hz.
 *
 * Eight times what shipped until 2026-09-13, and the earlier comment here was
 * wrong about why the brain could not tell boards apart. At 16 Hz over 120 cells
 * a channel delivers ~290 spikes in 150 ms, each worth 0.275 mV against a 7 mV
 * threshold that needs ~25 of them at once: the stimulus died at the first
 * synapse. Measured across 400 boards a level, the board's identity in a
 * downstream population went from 5% to 32% once this, the channel width and the
 * integration window were all fixed together (docs/context/08-boss-mode.md).
 *
 * 128 Hz is high for a fly neuron but under its own refractory ceiling; the
 * earlier sweep needed 2,400 Hz, which is not a rate any cell can produce, and
 * was abandoned for exactly that reason.
 */
const RATE = { green: 128, yellow: 72, gray: 24, unknown: 3.2 } as const;

/**
 * What she knows about a letter, as a rate. A player looking at the keyboard
 * sees this; without it she was playing by slot colour alone and could not
 * possibly know which letters she had already spent.
 */
const LETTER_RATE = { untried: 3.2, absent: 16, present: 112 } as const;
export type LetterState = keyof typeof LETTER_RATE;

/**
 * Neurons per input channel.
 *
 * 120 cells in a brain of 138,639 is a whisper. Widening the channel is the
 * honest way to deliver more spikes — the same total arrives from more cells
 * each firing at a rate a fly can actually produce, which is only to say the
 * board covers more of what she is looking at. Capped by the populations: the
 * 20 slot channels divide 8,038 visual projection cells, the 27 letter channels
 * divide 16,352 sensory ones.
 */
const CHANNEL_SIZE = 400;

export interface BossWiring {
  /** Slot colours first, then one channel per letter. Nothing else. */
  channels: StimulusChannel[];
  /** Index into `channels` for slot `p` in state `s`. */
  channelOf: (slot: number, state: SlotState) => number;
  /** Index into `channels` for one letter of the alphabet. */
  letterChannel: (letter: string) => number;
  /** Every descending cell. This is the whole output pathway of the brain. */
  readout: Int32Array;
  /** Their FlyWire cell-type names, for the interface. */
  readoutNames: string[];
}

/**
 * Splits a population into `count` disjoint blocks of `size`. Deterministic:
 * the same connectome always yields the same wiring, so a replay matches.
 */
function blocks(pool: Int32Array, count: number, size: number): Int32Array[] {
  const out: Int32Array[] = [];
  const stride = Math.floor(pool.length / count);
  if (stride < size) throw new Error(`population too small: ${pool.length} for ${count}x${size}`);
  for (let c = 0; c < count; c += 1) out.push(pool.subarray(c * stride, c * stride + size));
  return out;
}

export function buildWiring(connectome: Connectome): BossWiring {
  const sensory = neuronsOfClass(connectome, 'sensory');
  const visual = neuronsOfClass(connectome, 'visual_projection');
  // The board is something she looks at, so it enters through visual pathways.
  const boardChannels = WORD_LENGTH * SLOT_STATES.length;
  const visualBlocks = blocks(visual, boardChannels, CHANNEL_SIZE);

  // The keyboard she has in her head: one channel per letter, through plain
  // sensory. The blocks are still cut for LETTERS + 1 so that removing the
  // cerco did not shift every other letter onto different neurons.
  const letterBlocks = blocks(sensory, LETTERS + 1, CHANNEL_SIZE);

  const channels: StimulusChannel[] = visualBlocks.map((neurons) => ({ neurons, rate: 0 }));
  for (let l = 0; l < LETTERS; l += 1) channels.push({ neurons: letterBlocks[l], rate: 0 });

  // Every one of them, in connectome order. Sorting by in-degree and keeping a
  // slice is what went wrong before; there is nothing to choose here now.
  const readout = neuronsOfClass(connectome, 'descending');

  return {
    channels,
    channelOf: (slot, state) => slot * SLOT_STATES.length + SLOT_STATES.indexOf(state),
    letterChannel: (letter) => boardChannels + ALPHABET.indexOf(letter),
    readout,
    readoutNames: [...readout].map((i) => connectome.cellTypes[connectome.cellType[i]] ?? '?'),
  };
}

/**
 * Points the stimulus at one board: a colour per slot, and what she knows about
 * each letter. That is all she gets, and it is exactly what a player sees.
 *
 * There used to be one more channel, the "cerco": 1 to 16 Hz by how few answers
 * were still compatible with her colours. That number is the output of a
 * deductive solver, so feeding it in was telling the brain the algorithm's
 * conclusion and then admiring the brain for knowing it. Removed 2026-09-13.
 */
export function applyBoard(
  wiring: BossWiring,
  slots: readonly SlotState[],
  letters: ReadonlyMap<string, LetterState> = new Map(),
): void {
  for (const channel of wiring.channels) channel.rate = 0;
  for (let slot = 0; slot < WORD_LENGTH; slot += 1) {
    const state = slots[slot] ?? 'unknown';
    wiring.channels[wiring.channelOf(slot, state)].rate = RATE[state];
  }
  for (let l = 0; l < LETTERS; l += 1) {
    const letter = ALPHABET[l];
    wiring.channels[wiring.letterChannel(letter)].rate =
      LETTER_RATE[letters.get(letter) ?? 'untried'];
  }
}
