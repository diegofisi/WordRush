/**
 * The control experiment: does the fly do anything?
 *
 *   npx jest --roots tools --testTimeout 3600000 -t "control"
 *
 * Three flies play the same rounds — same words, same seeds, same eight
 * candidates offered each turn:
 *
 *   brain intact   her readout chooses among the eight, as the game does
 *   synapses cut   every weight zeroed; the readout sees silence
 *   random choice  a coin picks among the same eight, no brain at all
 *
 * The comparison that matters is the first against the third. The game's
 * filter (docs/context/08-boss-mode.md) does the deduction on her behalf, and
 * a fly choosing at random after that filter already solves most rounds. If
 * her brain does not beat the coin on the same candidates, it is decorating a
 * game the filter is winning. The silenced fly is kept because it was the
 * original control and because it shows what "no brain" looks like on the
 * panel: with zero input the readout always says the same thing.
 *
 * Measured history, all in docs/context/09-what-the-fly-can-do.md:
 *   2026-09-13, filter + policy, 8 attempts: intact 3.55, cut 3.45 attempts,
 *     40/40 both — the brain contributed nothing.
 *   2026-09-13, no filter at all: 0/30 solved, 0/30 rounds differed.
 *   2026-09-14, the game as shipped now (filter, 8 candidates, 4 attempts),
 *     120 rounds, seeds mixed: intact 43/120, cut 41/120, coin 49/120;
 *     intact and cut differed in 119/120. Her choice is real and it does not
 *     beat a coin.
 *
 * Rounds are independent, so they run on 70 % of the cores.
 */
import { existsSync, readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import esWords from '@modules/words/data/es.json';
import { computeFeedback } from '@modules/game/domain/services/color-feedback';
import { BOSS } from '@shared/contract';
import { candidatesFrom, drawCandidates } from '../src/modules/boss/domain/services/boss-solver';

jest.setTimeout(60 * 60 * 1000);

const ROUNDS = Number(process.env.BOSS_CONTROL_ROUNDS ?? 30);
const WORKERS = Math.max(1, Number(process.env.BOSS_WORKERS ?? Math.floor(cpus().length * 0.7)));

interface RoundOutcome {
  /** Attempts to solve, or maxAttempts + 1 when she did not. */
  intact: number;
  cut: number;
  coin: number;
  /** Whether the intact and cut flies ever played a different word. */
  differed: boolean;
  intactWords: string[];
  cutWords: string[];
  coinWords: string[];
}

it('control: her brain against a coin on the same candidates', async () => {
  const file = join(__dirname, '..', 'src', 'modules', 'boss', 'data', 'readout.json');
  if (!existsSync(file)) throw new Error('train the readout first');
  expect(JSON.parse(readFileSync(file, 'utf8')).inputs).toBeGreaterThan(0);

  const per = Math.ceil(ROUNDS / WORKERS);
  const parts = await Promise.all(
    Array.from({ length: WORKERS }, (_, k) => {
      const from = k * per;
      const to = Math.min(ROUNDS, from + per);
      return new Promise<RoundOutcome[]>((resolve, reject) => {
        if (from >= to) return resolve([]);
        const worker = new Worker(join(__dirname, 'boss-control.worker.js'), {
          workerData: { from, to, maxAttempts: BOSS.maxAttempts, candidates: BOSS.candidates },
        });
        worker.on('message', resolve);
        worker.on('error', reject);
      });
    }),
  );
  const outcomes = parts.flat();
  expect(outcomes).toHaveLength(ROUNDS);

  const max = BOSS.maxAttempts;
  const solved = (pick: (o: RoundOutcome) => number) =>
    outcomes.filter((o) => pick(o) <= max).length;
  const mean = (pick: (o: RoundOutcome) => number) =>
    outcomes.reduce((a, o) => a + pick(o), 0) / outcomes.length;
  const pct = (n: number) => ((n / ROUNDS) * 100).toFixed(1);

  console.log(
    `  ${ROUNDS} rounds, ${max} attempts, ${BOSS.candidates} candidates a turn, same words and seeds for all three:`,
  );
  console.log(
    `    brain intact  : solved ${solved((o) => o.intact)}/${ROUNDS} (${pct(solved((o) => o.intact))}%), ${mean((o) => o.intact).toFixed(2)} attempts`,
  );
  console.log(
    `    synapses cut  : solved ${solved((o) => o.cut)}/${ROUNDS} (${pct(solved((o) => o.cut))}%), ${mean((o) => o.cut).toFixed(2)} attempts`,
  );
  console.log(
    `    coin toss     : solved ${solved((o) => o.coin)}/${ROUNDS} (${pct(solved((o) => o.coin))}%), ${mean((o) => o.coin).toFixed(2)} attempts`,
  );
  console.log(
    `    rounds where intact and cut played different words: ${outcomes.filter((o) => o.differed).length}/${ROUNDS}`,
  );
  // Every round, so a suspicious total can be checked against its parts.
  const show = (o: RoundOutcome, k: keyof RoundOutcome, ws: string[]) =>
    `${String(o[k]).padStart(2)} ${ws.join(' ').padEnd(30)}`;
  for (const [i, o] of outcomes.entries()) {
    console.log(
      `    r${String(i).padStart(2, '0')}  intact ${show(o, 'intact', o.intactWords)} cut ${show(o, 'cut', o.cutWords)} coin ${show(o, 'coin', o.coinWords)}`,
    );
  }

  // The claim is that she does *something*: her choice must at least differ
  // from a dead brain's. Whether it beats the coin is reported, not asserted —
  // that number is the honest measure of her, and it goes on her page.
  expect(outcomes.filter((o) => o.differed).length).toBeGreaterThan(0);
});

// Keep the word-list types honest for the worker's sake.
void computeFeedback;
void candidatesFrom;
void drawCandidates;
void esWords;
