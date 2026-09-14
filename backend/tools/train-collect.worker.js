/*
 * One core's share of the training boards.
 *
 * Collecting is the whole cost of training: fitting 1,100 weights takes
 * seconds, while simulating 900 boards of 900 ms each takes hours on one core.
 * The boards are independent, so they split cleanly — only the 0.1 ms time step
 * inside a board has to stay serial.
 *
 * Plain CommonJS against `dist/` because a worker thread does not inherit
 * ts-jest's transform, which is the same reason the brain worker is compiled.
 */
const { parentPort, workerData } = require('node:worker_threads');
const { join } = require('node:path');

const dist = join(__dirname, '..', 'dist', 'modules');
const { loadConnectome } = require(join(dist, 'boss/domain/services/connectome.js'));
const { buildWiring, applyBoard } = require(join(dist, 'boss/domain/services/boss-wiring.js'));
const { LifNetwork, makeRandom } = require(join(dist, 'boss/domain/services/lif-network.js'));
const { computeFeedback } = require(join(dist, 'game/domain/services/color-feedback.js'));
const words = require(join(dist, 'words/data/es.json'));

const { from, to, settle, window: WINDOW, seed } = workerData;

const connectome = loadConnectome();
const wiring = buildWiring(connectome);
const rates = new Float32Array(wiring.readout.length);

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzñ';
const LETTERS = ALPHABET.length;
const HINT_OUTPUT = LETTERS;
const OUTPUTS = LETTERS + 1;
// She types from the whole dictionary, so the boards she reaches come from it.
const guessable = [...new Set([...words.allowed, ...words.answers])];
const answers = words.answers;

const rnd = makeRandom(seed);
const X = [];
const Y = [];

for (let n = 0; n < to; n += 1) {
  const answer = answers[(rnd() * answers.length) | 0];
  const slots = ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'];
  const letters = new Map();

  // A third of the boards arrive with a hint already spent: rooms can have
  // hints on or off, and she has to read both kinds.
  if (rnd() < 0.34) letters.set(answer[(rnd() * answer.length) | 0], 'present');

  const turns = (rnd() * 4) | 0;
  for (let t = 0; t < turns; t += 1) {
    const guess = guessable[(rnd() * guessable.length) | 0];
    const feedback = computeFeedback(guess, answer);
    for (let i = 0; i < slots.length; i += 1) {
      const colour = feedback.colors[i];
      if (colour === 'green') slots[i] = 'green';
      else if (slots[i] !== 'green') slots[i] = colour === 'yellow' ? 'yellow' : 'gray';
      const letter = guess[i];
      if (colour === 'gray') {
        if (!letters.has(letter)) letters.set(letter, 'absent');
      } else {
        letters.set(letter, 'present');
      }
    }
  }
  const netSeed = ((rnd() * 1e9) | 0) >>> 0;
  if (n < from) continue;

  const net = new LifNetwork(connectome, makeRandom(netSeed));
  applyBoard(wiring, slots, letters);
  net.reset();
  net.run(wiring.channels, settle);
  net.resetCounts();
  net.run(wiring.channels, WINDOW);
  net.ratesOf(wiring.readout, WINDOW, rates);
  X.push(Array.from(rates));

  // The target: the letters really in the word, and whether the hint is still
  // worth spending. Ground truth about the board, never a solver's opinion.
  const target = new Float32Array(OUTPUTS);
  const distinct = new Set(answer);
  for (const letter of distinct) {
    const index = ALPHABET.indexOf(letter);
    if (index >= 0) target[index] = 1;
  }
  let found = 0;
  for (const letter of distinct) if (letters.get(letter) === 'present') found += 1;
  target[HINT_OUTPUT] = found * 2 < distinct.size ? 1 : 0;
  Y.push(Array.from(target));

  if ((X.length & 15) === 0) parentPort.postMessage({ progress: X.length });
}

parentPort.postMessage({ X, Y });
