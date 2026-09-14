/**
 * The control experiment: does the connectome actually do anything?
 *
 *   npx jest --roots tools --testTimeout 3600000 -t "control"
 *
 * The same readout, the same stimulus, the same word list. The only change is
 * that every synapse is cut, so the readout sees a brain that cannot propagate
 * anything. If she played the same way silenced, the brain would be decoration
 * and this file would say so.
 *
 * Measured on 2026-09-13, before the solver was taken out of her play: intact
 * 3.55 attempts, silenced 3.45, both solving 40/40. The connectome changed what
 * she played in 21 of 40 rounds and made her no better at the game, because the
 * candidate filter was doing the playing. That measurement is why the filter is
 * gone and why this file now plays her the way the game does.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import esWords from '@modules/words/data/es.json';
import { computeFeedback } from '@modules/game/domain/services/color-feedback';
import { loadConnectome } from '../src/modules/boss/domain/services/connectome';
import { LifNetwork, makeRandom } from '../src/modules/boss/domain/services/lif-network';
import {
  applyBoard,
  buildWiring,
  type LetterState,
  type SlotState,
} from '../src/modules/boss/domain/services/boss-wiring';
import {
  LetterReadout,
  scoreWord,
  type ReadoutWeights,
} from '../src/modules/boss/domain/services/letter-readout';

jest.setTimeout(60 * 60 * 1000);

const ROUNDS = Number(process.env.BOSS_CONTROL_ROUNDS ?? 24);
// The same numbers the game plays with.
const WINDOW_MS = 900;
const SETTLE_MS = 60;

it('control: silencing the connectome changes how she plays', () => {
  const file = join(__dirname, '..', 'src', 'modules', 'boss', 'data', 'readout.json');
  if (!existsSync(file)) throw new Error('train the readout first');
  const readout = new LetterReadout(JSON.parse(readFileSync(file, 'utf8')) as ReadoutWeights);

  const live = loadConnectome();
  const wiring = buildWiring(live);
  const rates = new Float32Array(wiring.readout.length);

  // The silenced brain is the same object with every weight zeroed.
  const cut = new Float32Array(live.weights.length);
  const silenced = { ...live, weights: cut };

  // She types from the whole dictionary, exactly as a human does.
  const guessable = [...new Set([...esWords.allowed, ...esWords.answers])];

  const play = (brain: typeof live, seed: number) => {
    const answers = esWords.answers;
    const rnd = makeRandom(seed);
    const answer = answers[(rnd() * answers.length) | 0];
    const played = new Set<string>();
    const letters = new Map<string, LetterState>();
    const slots: SlotState[] = ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'];

    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const net = new LifNetwork(brain, makeRandom(seed * 31 + attempt));
      applyBoard(wiring, slots, letters);
      net.reset();
      net.run(wiring.channels, SETTLE_MS);
      net.resetCounts();
      net.run(wiring.channels, WINDOW_MS);
      net.ratesOf(wiring.readout, WINDOW_MS, rates);
      readout.run(rates);

      // Exactly what the game does: every unplayed word is legal, and her
      // readout alone picks between them.
      let word = guessable[0];
      let best = -Infinity;
      for (const option of guessable) {
        if (played.has(option)) continue;
        const score = scoreWord(option, readout.wanted);
        if (score > best) {
          best = score;
          word = option;
        }
      }
      played.add(word);

      const feedback = computeFeedback(word, answer);
      if (word === answer) return attempt;
      for (let i = 0; i < feedback.colors.length; i += 1) {
        const colour = feedback.colors[i];
        if (colour === 'green') slots[i] = 'green';
        else if (slots[i] !== 'green') slots[i] = colour === 'yellow' ? 'yellow' : 'gray';
        if (colour === 'gray') {
          if (!letters.has(word[i])) letters.set(word[i], 'absent');
        } else {
          letters.set(word[i], 'present');
        }
      }
    }
    return 9;
  };

  const real: number[] = [];
  const dead: number[] = [];
  for (let r = 0; r < ROUNDS; r += 1) {
    const seed = 5000 + r;
    real.push(play(live, seed));
    dead.push(play(silenced, seed));
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const solved = (xs: number[]) => xs.filter((x) => x <= 8).length;

  console.log(`  ${ROUNDS} rounds, same words and same seeds for both:`);
  console.log(
    `    brain intact  : solved ${solved(real)}/${ROUNDS}, ${mean(real).toFixed(2)} attempts`,
  );
  console.log(
    `    synapses cut  : solved ${solved(dead)}/${ROUNDS}, ${mean(dead).toFixed(2)} attempts`,
  );
  const differed = real.filter((value, index) => value !== dead[index]).length;
  console.log(`    rounds that played out differently: ${differed}/${ROUNDS}`);

  // The claim is dependence, not superiority of biology: the brain has to matter.
  expect(differed).toBeGreaterThan(0);
});
