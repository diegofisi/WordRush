/*
 * One core's share of the control rounds.
 *
 * Each round is played three times on identical candidates: by her readout on
 * an intact brain, by her readout on a brain with every synapse cut, and by a
 * coin. The draw of eight candidates per turn is seeded per round and replayed
 * for all three, so the only thing that differs between them is who chooses.
 *
 * Plain CommonJS against `dist/`, like the other workers: a worker thread does
 * not inherit ts-jest's transform.
 */
const { parentPort, workerData } = require('node:worker_threads');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const dist = join(__dirname, '..', 'dist', 'modules');
const { loadConnectome } = require(join(dist, 'boss/domain/services/connectome.js'));
const { buildWiring, applyBoard } = require(join(dist, 'boss/domain/services/boss-wiring.js'));
const { LifNetwork, makeRandom } = require(join(dist, 'boss/domain/services/lif-network.js'));
const { LetterReadout, scoreWord } = require(join(dist, 'boss/domain/services/letter-readout.js'));
const { candidatesFrom, drawCandidates } = require(
  join(dist, 'boss/domain/services/boss-solver.js'),
);
const { computeFeedback } = require(join(dist, 'game/domain/services/color-feedback.js'));
const words = require(join(dist, 'words/data/es.json'));

const { from, to, maxAttempts, candidates: K } = workerData;

// The game's own numbers, so the control measures what ships.
const SETTLE_MS = 60;
const WINDOW_MS = 900;

const readout = new LetterReadout(
  JSON.parse(readFileSync(join(__dirname, '..', 'src/modules/boss/data/readout.json'), 'utf8')),
);
const live = loadConnectome();
const wiring = buildWiring(live);
const cut = { ...live, weights: new Float32Array(live.weights.length) };
const rates = new Float32Array(wiring.readout.length);

const pool = [...new Set([...words.allowed, ...words.answers])];
const answers = words.answers;

/** Colours of one guess against the answer, as the board keeps them. */
function boardAfter(rows, guess, answer) {
  const { colors } = computeFeedback(guess, answer);
  rows.push({ word: guess, colors });
}

function slotsOf(rows) {
  const slots = ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'];
  for (const row of rows) {
    for (let i = 0; i < 5; i += 1) {
      const colour = row.colors[i];
      if (colour === 'green') slots[i] = 'green';
      else if (slots[i] !== 'green') slots[i] = colour === 'yellow' ? 'yellow' : 'gray';
    }
  }
  return slots;
}

function lettersOf(rows) {
  const state = new Map();
  for (const row of rows) {
    for (let i = 0; i < 5; i += 1) {
      const letter = row.word[i];
      if (row.colors[i] === 'gray') {
        if (!state.has(letter)) state.set(letter, 'absent');
      } else state.set(letter, 'present');
    }
  }
  return state;
}

/** Her readout's pick among `shown`, on `brain`, looking at `rows`. */
function brainPick(brain, rows, shown, seed) {
  const net = new LifNetwork(brain, makeRandom(seed));
  applyBoard(wiring, slotsOf(rows), lettersOf(rows));
  net.reset();
  net.run(wiring.channels, SETTLE_MS);
  net.resetCounts();
  net.run(wiring.channels, WINDOW_MS);
  net.ratesOf(wiring.readout, WINDOW_MS, rates);
  readout.run(rates);
  let best = shown[0];
  let bestScore = -Infinity;
  for (const option of shown) {
    const score = scoreWord(option, readout.wanted);
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best;
}

/**
 * Scatters a seed before it reaches the LCG. Consecutive seeds into
 * `makeRandom` give first draws 0.0004 apart, which made three rounds in a row
 * play the same answer; this is the murmur3 finaliser, so seed n and n + 1
 * land nowhere near each other.
 */
function mix(seed) {
  let h = seed >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * One round for one chooser. Returns attempts to solve, or maxAttempts + 1.
 * `wordsPlayed` collects the sequence so intact and cut can be compared.
 */
function play(chooser, roundSeed, wordsPlayed) {
  const rnd = makeRandom(mix(roundSeed));
  const answer = answers[(rnd() * answers.length) | 0];
  const draw = makeRandom(mix(roundSeed * 7 + 1));
  const rows = [];
  const played = new Set();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const compatible = candidatesFrom(pool, rows, null).filter((w) => !played.has(w));
    const shown = drawCandidates(compatible.length ? compatible : pool, K, draw);
    const guess = chooser(rows, shown, mix(roundSeed * 31 + attempt));
    wordsPlayed.push(guess);
    played.add(guess);
    if (guess === answer) return attempt;
    boardAfter(rows, guess, answer);
  }
  return maxAttempts + 1;
}

const outcomes = [];
for (let r = from; r < to; r += 1) {
  const seed = 5000 + r;
  const coinRnd = makeRandom(mix(seed * 13 + 5));
  const intactWords = [];
  const cutWords = [];
  const intact = play((rows, shown, s) => brainPick(live, rows, shown, s), seed, intactWords);
  const dead = play((rows, shown, s) => brainPick(cut, rows, shown, s), seed, cutWords);
  const coinWords = [];
  const coin = play((rows, shown) => shown[(coinRnd() * shown.length) | 0], seed, coinWords);
  const differed =
    intactWords.length !== cutWords.length || intactWords.some((w, i) => w !== cutWords[i]);
  outcomes.push({ intact, cut: dead, coin, differed, intactWords, cutWords, coinWords });
}

parentPort.postMessage(outcomes);
