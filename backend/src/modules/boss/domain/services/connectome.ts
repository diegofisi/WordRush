import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/**
 * The real fly brain: FlyWire release 783, pruned to connections of at least
 * five synapses. Data and attribution live in `../../data/` and are CC-BY 4.0.
 *
 * Format, as published by fly-brain-bench: LEB128 varints, `row_counts[N]`
 * then per-row delta-encoded `targets[E]` then `synapses[E]`, with one
 * excitatory/inhibitory bit per neuron (Dale's law, from the neurotransmitter
 * call) rather than one per edge.
 */

/** Synaptic weight of a single synapse, in mV. Shiu et al. */
export const W_SYNAPSE = 0.275;

export interface Connectome {
  neurons: number;
  edges: number;
  /** CSR row pointers, length neurons + 1. */
  indptr: Int32Array;
  /** CSR targets, length edges. */
  indices: Int32Array;
  /** Signed mV per edge: synapses x W_SYNAPSE, negative when the source inhibits. */
  weights: Float32Array;
  /** Per-neuron class index into `superClasses`. */
  superClass: Uint16Array;
  superClasses: string[];
  cellType: Uint16Array;
  cellTypes: string[];
  excitatory: (index: number) => boolean;
}

function varintReader(bytes: Uint8Array) {
  let p = 0;
  return {
    read(out: Int32Array, n: number): void {
      let value: number, shift: number, byte: number;
      let q = p;
      for (let i = 0; i < n; i += 1) {
        value = 0;
        shift = 0;
        do {
          byte = bytes[q];
          q += 1;
          value |= (byte & 0x7f) << shift;
          shift += 7;
        } while (byte & 0x80);
        out[i] = value;
      }
      p = q;
    },
  };
}

let cached: Connectome | null = null;

/** Loads and decodes the connectome once per process. Takes about 1 s. */
export function loadConnectome(dataDir = join(__dirname, '..', '..', 'data')): Connectome {
  if (cached) return cached;

  const read = (name: string) => gunzipSync(readFileSync(join(dataDir, name)));
  const meta = JSON.parse(read('meta.json.gz').toString()) as {
    n_neurons: number;
    n_edges: number;
    dicts: Record<string, string[]>;
  };
  const neurons = meta.n_neurons;
  const edges = meta.n_edges;

  const conn = read('conn.bin.gz');
  const signBits = read('sign.bin.gz');
  const reader = varintReader(conn);

  const counts = new Int32Array(neurons);
  reader.read(counts, neurons);

  const indptr = new Int32Array(neurons + 1);
  for (let i = 0; i < neurons; i += 1) indptr[i + 1] = indptr[i] + counts[i];
  if (indptr[neurons] !== edges) {
    throw new Error(`connectome edge count mismatch: ${indptr[neurons]} vs ${edges}`);
  }

  const indices = new Int32Array(edges);
  reader.read(indices, edges);
  for (let i = 0; i < neurons; i += 1) {
    const from = indptr[i];
    const to = indptr[i + 1];
    for (let e = from + 1; e < to; e += 1) indices[e] += indices[e - 1];
  }

  const synapses = new Int32Array(edges);
  reader.read(synapses, edges);

  const excitatory = (index: number) => ((signBits[index >> 3] >> (7 - (index & 7))) & 1) === 1;
  const weights = new Float32Array(edges);
  for (let i = 0; i < neurons; i += 1) {
    const scale = excitatory(i) ? W_SYNAPSE : -W_SYNAPSE;
    for (let e = indptr[i], to = indptr[i + 1]; e < to; e += 1) weights[e] = synapses[e] * scale;
  }

  const labels = new Uint16Array(read('labels.bin.gz').buffer);
  cached = {
    neurons,
    edges,
    indptr,
    indices,
    weights,
    superClass: labels.subarray(0, neurons),
    superClasses: meta.dicts.super_class,
    cellType: labels.subarray(neurons * 2, neurons * 3),
    cellTypes: meta.dicts.cell_type,
    excitatory,
  };
  return cached;
}

/** Indices of every neuron in a super class, e.g. `descending` or `sensory`. */
export function neuronsOfClass(connectome: Connectome, className: string): Int32Array {
  const wanted = connectome.superClasses.indexOf(className);
  if (wanted < 0) throw new Error(`unknown super class: ${className}`);
  const found: number[] = [];
  for (let i = 0; i < connectome.neurons; i += 1) {
    if (connectome.superClass[i] === wanted) found.push(i);
  }
  return Int32Array.from(found);
}

/** How many edges arrive at each neuron: a cheap proxy for how strongly driven it is. */
export function inDegrees(connectome: Connectome): Int32Array {
  const degrees = new Int32Array(connectome.neurons);
  for (let e = 0; e < connectome.edges; e += 1) degrees[connectome.indices[e]] += 1;
  return degrees;
}
