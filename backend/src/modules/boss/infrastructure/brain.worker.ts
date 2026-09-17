import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import type { BossFrame } from '@shared/contract';
import { loadConnectome } from '../domain/services/connectome';
import {
  applyBoard,
  buildWiring,
  type LetterState,
  type SlotState,
} from '../domain/services/boss-wiring';
import { LifNetwork, makeRandom } from '../domain/services/lif-network';
import { neuronsOfClass } from '../domain/services/connectome';
import { LetterReadout, type ReadoutWeights } from '../domain/services/letter-readout';
import cloudSample from '../data/cloud-sample.json';

/**
 * The fly's brain, on its own thread.
 *
 * Simulating 138,639 neurons for 150 ms of biological time costs around half a
 * second of wall time. On the main thread that would freeze every socket in
 * every room for half a second, so it lives here and the game asks it questions.
 */

/** Keep simulating whatever she is looking at, and stream what happens. */
export interface BrainIdle {
  idle: true;
  on: boolean;
  slots?: SlotState[];
  letters?: [string, LetterState][];
}

export interface BrainRequest {
  id: number;
  slots: SlotState[];
  letters: [string, LetterState][];
  /** Same seed, same spike train: a round can be replayed exactly. */
  seed: number;
}

export interface BrainResponse {
  id: number;
  /** Firing rate of every readout cell over the decision window, in Hz. */
  rates: number[];
  /** Biological milliseconds simulated, and what that cost in wall time. */
  biologicalMs: number;
  wallMs: number;
  /** Total spikes in the whole brain during the window. */
  spikes: number;
  /** Everything the interface draws. All of it read off the running model. */
  telemetry: BrainTelemetry;
}

export interface BrainTelemetry {
  /** Spike times in biological ms, one row per readout cell. */
  raster: number[][];
  /** Membrane voltage over all 138,639 neurons, 26 bins from -54 to -43 mV. */
  voltage: number[];
  /** Firing rate in Hz per neuron, by anatomical class. */
  populations: { name: string; hz: number }[];
  /** Excitatory and inhibitory mV delivered during the window. */
  excitatory: number;
  inhibitory: number;
  /** Which of the 1,600 sampled neurons fired, as indices into that sample. */
  cloud: number[];
  /** Poisson rate injected into each board slot, in Hz. */
  stimulus: number[];
}

export interface BrainReady {
  ready: true;
  neurons: number;
  edges: number;
  readoutNames: string[];
  loadMs: number;
}

const SETTLE_MS = 60;
/**
 * How long she looks at the board before answering.
 *
 * It was 150 ms, and that was the single biggest thing wrong with her. At ~10 Hz
 * a cell fires once or twice in 150 ms, so every firing rate we read was an
 * estimate from one or two events — noise we were adding in the measurement, not
 * noise in the brain. Measured over 400 boards a level, the letters she can read
 * off a downstream population go 13.7% -> 23.9% -> 15.9% as this goes
 * 400 -> 900 -> 1800 ms.
 *
 * It peaks at 900 and falls after, and that is not noise: at full synaptic
 * strength a 1,800 ms window runs to 14.5 million spikes a board, the network
 * sustains an avalanche, and the detail burns off. Weakening the synapses
 * removes the peak and keeps improving to 32.3%, but that means departing from
 * Shiu et al., and 900 ms at the published strength is enough to play with
 * (docs/context/08-boss-mode.md).
 *
 * 675 since 2026-09-15, as a balance decision and not a calibration: the
 * readout was fitted at 900 ms and her choice was measured to be no better
 * than a coin at 900 and at 400 alike, so a quarter less window costs her
 * nothing she had and makes her a quarter faster. The tools (training, the
 * control) still simulate 900 ms; the runtime rates are per second, so the
 * readout reads them on the same scale.
 */
const WINDOW_MS = 675;

const started = Date.now();
const silenced = (workerData as { silenced?: boolean } | undefined)?.silenced === true;
const connectome = loadConnectome();
const wiring = buildWiring(connectome);

// The control condition: the same readout cells, the same stimulus, but every
// synapse cut. If the fly still played as well, the brain would be decoration.
if (silenced) connectome.weights.fill(0);

const network = new LifNetwork(connectome, Math.random);
const rates = new Float32Array(wiring.readout.length);

/** Anatomical groups the panel reports, straight from the FlyWire annotations. */
const POPULATIONS = ['sensory', 'central', 'descending', 'motor'] as const;
const groups = POPULATIONS.map((name) => ({ name, neurons: neuronsOfClass(connectome, name) }));
const cloud = Int32Array.from(cloudSample.indices);
/** The raster shows 16 readout cells; 1,299 rows is not a picture. */
const watched = wiring.readout.slice(0, 16);

/**
 * How many readout rates travel to the panel.
 *
 * The readout itself reads all 1,299 descending cells — that is the thing that
 * had to change for her to see the board at all. Sending 1,299 numbers six times
 * a second to draw a diagram that can label sixteen of them would be a hundred
 * kilobytes a second for nothing, so the panel gets the first slice. The brain
 * uses every one of them; the picture shows these.
 */
const SHOWN = 64;

const ready: BrainReady = {
  ready: true,
  neurons: connectome.neurons,
  edges: connectome.edges,
  readoutNames: wiring.readoutNames,
  loadMs: Date.now() - started,
};
parentPort?.postMessage(ready);

/* ---- the live stream ---------------------------------------------------- */

/**
 * 20 biological ms per slice, three a second.
 *
 * A slice costs about 150 ms of wall time, and a decision (60 + 900 ms) about
 * seven seconds, on the same thread. At one slice every 160 ms the stream alone
 * kept the thread 93 % busy, a decision arriving behind it overran its timeout,
 * the turn retried into a thread still running the discarded one, and the fly
 * fell silent with the stream frozen (2026-09-14). Every 320 ms halves the load
 * and the panel still moves.
 */
const SLICE_MS = 20;
const SLICE_EVERY_MS = 320;

const live = new LifNetwork(connectome, Math.random);
const liveRates = new Float32Array(wiring.readout.length);

/**
 * The same trained readout the turn uses, run on the live rates. Without it the
 * diagram's hidden and letter columns would only move once a turn, which is
 * what made it look frozen.
 */
const readoutFile = join(__dirname, '..', 'data', 'readout.json');
const liveReadout = existsSync(readoutFile)
  ? new LetterReadout(JSON.parse(readFileSync(readoutFile, 'utf8')) as ReadoutWeights)
  : null;
let streaming = false;
let timer: NodeJS.Timeout | null = null;

/**
 * How hard each sampled cell fired in this slice, two bits each: 0 to 3 spikes,
 * saturating. A single bit said only "fired at all", and in a 20 ms window that
 * is true of about one cell in six — the panel lit them all equally and the
 * cloud washed out. Counting the spikes is both cheaper to read and more
 * informative: most cells fire once, a few fire three times, and the cloud now
 * shows that difference.
 */
function cloudCounts(net: LifNetwork): string {
  const bytes = new Uint8Array(Math.ceil(cloud.length / 4));
  for (let k = 0; k < cloud.length; k += 1) {
    const index = cloud[k];
    if (index === undefined) continue;
    const spikes = Math.min(3, net.spikeCount[index] ?? 0);
    if (spikes === 0) continue;
    const shift = 6 - (k & 3) * 2;
    bytes[k >> 2] = (bytes[k >> 2] ?? 0) | (spikes << shift);
  }
  return Buffer.from(bytes).toString('base64');
}

function slice(): void {
  const wall = Date.now();
  live.resetCounts();
  const recorded = live.runRecording(wiring.channels, SLICE_MS, watched);
  live.ratesOf(wiring.readout, SLICE_MS, liveRates);
  const preference = liveReadout?.run(liveRates);
  const seconds = SLICE_MS / 1000;
  const frame: BossFrame = {
    cloud: cloudCounts(live),
    voltage: [...live.voltageHistogram(26)],
    populations: groups.map((group) => {
      let total = 0;
      for (let k = 0; k < group.neurons.length; k += 1) {
        total += live.spikeCount[group.neurons[k] ?? 0];
      }
      return Math.round((total / group.neurons.length / seconds) * 10) / 10;
    }),
    raster: recorded.raster,
    descending: [...liveRates.subarray(0, SHOWN)].map((v) => Math.round(v)),
    letters: preference ? [...preference] : [],
    excitatory: Math.round(live.excitatory),
    inhibitory: Math.round(live.inhibitory),
    biologicalMs: SLICE_MS,
    wallMs: Date.now() - wall,
  };
  parentPort?.postMessage(frame);
}

function setStreaming(on: boolean): void {
  if (on === streaming) return;
  streaming = on;
  if (!on) {
    if (timer) clearInterval(timer);
    timer = null;
    return;
  }
  live.reset();
  live.run(wiring.channels, 40);
  timer = setInterval(slice, SLICE_EVERY_MS);
  timer.unref();
}

parentPort?.on('message', (request: BrainRequest | BrainIdle) => {
  if ('idle' in request) {
    if (request.slots) {
      applyBoard(wiring, request.slots, new Map(request.letters ?? []));
    }
    setStreaming(request.on);
    return;
  }
  const wall = Date.now();
  const random = makeRandom(request.seed);
  const net = new LifNetwork(connectome, random);
  applyBoard(wiring, request.slots, new Map(request.letters));
  net.reset();
  net.run(wiring.channels, SETTLE_MS);
  net.resetCounts();
  const recorded = net.runRecording(wiring.channels, WINDOW_MS, watched);
  const spikes = recorded.fired;
  net.ratesOf(wiring.readout, WINDOW_MS, rates);

  const seconds = WINDOW_MS / 1000;
  const populations = groups.map((group) => {
    let total = 0;
    for (let k = 0; k < group.neurons.length; k += 1) total += net.spikeCount[group.neurons[k]];
    return { name: group.name, hz: Math.round((total / group.neurons.length / seconds) * 10) / 10 };
  });

  const response: BrainResponse = {
    id: request.id,
    rates: [...rates],
    telemetry: {
      raster: recorded.raster,
      voltage: [...net.voltageHistogram(26)],
      populations,
      excitatory: Math.round(net.excitatory),
      inhibitory: Math.round(net.inhibitory),
      cloud: net.firedAmong(cloud),
      stimulus: wiring.channels.slice(0, 20).map((c) => c.rate),
    },
    biologicalMs: WINDOW_MS,
    wallMs: Date.now() - wall,
    spikes,
  };
  parentPort?.postMessage(response);
});

// `network` is only constructed so a mis-wired build fails at boot, not mid-round.
void network;
