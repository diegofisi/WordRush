/**
 * Builds the two position files the fly's brain panel draws.
 *
 * Both come out of the same FlyWire 783 coordinates and share one transform, so
 * the 64 readout cells land in the same space as the 8,000-neuron cloud behind
 * them. That is the whole reason this is one script and not two.
 *
 *   node scripts/build-boss-cloud.mjs
 *
 * Needs `backend/dist` to be built (`cd backend && npx nest build`), because it
 * reads the connectome and the wiring through the compiled modules rather than
 * re-implementing either.
 *
 * Writes:
 *   frontend/src/features/game/data/cloud.json           the 8,000-cell sample
 *   frontend/src/features/game/data/readout-circuit.json the 64 readout cells
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const dataIn = join(backend, 'src', 'modules', 'boss', 'data');
const dataOut = join(root, 'frontend', 'src', 'features', 'game', 'data');

const { loadConnectome } = require(join(backend, 'dist/modules/boss/domain/services/connectome.js'));
const { buildWiring } = require(join(backend, 'dist/modules/boss/domain/services/boss-wiring.js'));

const connectome = loadConnectome();
const wiring = buildWiring(connectome);
const sample = JSON.parse(readFileSync(join(dataIn, 'cloud-sample.json'), 'utf8')).indices;
const readout = Array.from(wiring.readout);

const rawPositions = gunzipSync(readFileSync(join(dataIn, 'pos.u16.bin.gz')));
const positions = new Uint16Array(
  rawPositions.buffer,
  rawPositions.byteOffset,
  rawPositions.length / 2,
);

/**
 * One transform for both files: a single scale across all three axes so the
 * brain is not stretched, and each axis centred on 128. It is fitted to the
 * 8,000-cell sample, which is what sets the frame everything else sits in.
 */
function transformOf(indices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const index of indices) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index * 3 + axis];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  }
  // 254, not 255: one byte of headroom at each end so nothing clips.
  const scale = 254 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const offset = [0, 1, 2].map((axis) => 128 - (scale * (min[axis] + max[axis])) / 2);
  return { scale, offset };
}

const { scale, offset } = transformOf(sample);

function packPositions(indices) {
  const bytes = new Uint8Array(indices.length * 3);
  for (let i = 0; i < indices.length; i += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = Math.round(scale * positions[indices[i] * 3 + axis] + offset[axis]);
      bytes[i * 3 + axis] = Math.max(0, Math.min(255, value));
    }
  }
  return Buffer.from(bytes).toString('base64');
}

// ---- the cloud -------------------------------------------------------------

const NAMES = [
  'acetylcholine',
  'dopamine',
  'gaba',
  'glutamate',
  'octopamine',
  'serotonin',
  'unknown',
];
const existingCloud = JSON.parse(readFileSync(join(dataOut, 'cloud.json'), 'utf8'));

writeFileSync(
  join(dataOut, 'cloud.json'),
  `${JSON.stringify({
    count: sample.length,
    nts: NAMES,
    pos: packPositions(sample),
    // The transmitter call per neuron is not recomputed here: it came from the
    // FlyWire annotations with the sample and has not changed.
    nt: existingCloud.nt,
  })}\n`,
);

// ---- the readout circuit ---------------------------------------------------

/**
 * The real synapses between the 64 readout cells. There are about two hundred
 * of them, which is why the circuit view can draw its connections instead of
 * inventing them: every line is an edge in the connectome.
 */
const rank = new Map(readout.map((neuron, i) => [neuron, i]));
const from = [];
const to = [];
const mv = [];
for (const source of readout) {
  for (let edge = connectome.indptr[source]; edge < connectome.indptr[source + 1]; edge += 1) {
    const target = rank.get(connectome.indices[edge]);
    if (target === undefined) continue;
    from.push(rank.get(source));
    to.push(target);
    mv.push(Math.round(connectome.weights[edge] * 100) / 100);
  }
}

// One bit per cell: does it excite or inhibit what it reaches (Dale's law).
const signs = new Uint8Array(Math.ceil(readout.length / 8));
readout.forEach((neuron, i) => {
  if (connectome.excitatory(neuron)) signs[i >> 3] |= 1 << (7 - (i & 7));
});

writeFileSync(
  join(dataOut, 'readout-circuit.json'),
  `${JSON.stringify({
    count: readout.length,
    pos: packPositions(readout),
    excitatory: Buffer.from(signs).toString('base64'),
    names: wiring.readoutNames,
    edges: { from, to, mv },
  })}\n`,
);

console.log(
  `cloud: ${sample.length} cells | circuit: ${readout.length} cells, ${from.length} real synapses`,
);
