/**
 * Trains the fly's readout: descending firing rates -> the letters she wants.
 *
 * Offline. Run it when the wiring or the word list changes:
 *   BOSS_SAMPLES=900 npx jest --roots tools --testTimeout 10800000 -t trains
 *
 * Only the readout is fitted. The connectome upstream of it is fixed anatomy
 * and is never touched, which is what makes the silencing control meaningful:
 * break the brain and the same weights stop working.
 *
 * The test fails if the brain does not beat a constant guess on data it has
 * never seen. That check has already caught one bad design: with the board
 * colours as her only input she could not see which letters she had spent, the
 * target was not predictable from what she could see, and the fit was worse
 * than ignoring the brain entirely.
 */
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadConnectome } from '../src/modules/boss/domain/services/connectome';
import { buildWiring } from '../src/modules/boss/domain/services/boss-wiring';
import {
  HINT_OUTPUT,
  LETTERS,
  OUTPUTS,
  type ReadoutWeights,
} from '../src/modules/boss/domain/services/letter-readout';

const SAMPLES = Number(process.env.BOSS_SAMPLES ?? 900);
const WINDOW_MS = 900;
const SETTLE_MS = 60;

jest.setTimeout(3 * 60 * 60 * 1000);

/*
 * The boards and their targets are built in `train-collect.worker.js`, next to
 * the simulation that consumes them: a worker thread cannot use this file's
 * TypeScript, and having two copies of "what the fly is shown" would be exactly
 * the kind of drift this project keeps paying for.
 */

it('trains the boss readout', async () => {
  const connectome = loadConnectome();
  const wiring = buildWiring(connectome);
  const inputs = wiring.readout.length;

  /*
   * Collecting is the whole cost — 1,200 boards of 900 ms each is twenty minutes
   * on half a desktop, against seconds of fitting — so the simulated rates are
   * cached. Changing how the readout is *fitted* then costs nothing, and the
   * cache is keyed by everything that would invalidate it. Delete the file, or
   * change any of those, to collect again.
   */
  const cacheKey = `${SAMPLES}-${inputs}-${SETTLE_MS}-${WINDOW_MS}-${OUTPUTS}`;
  const cachePath = join(__dirname, '..', 'node_modules', '.tmp', `boss-samples-${cacheKey}.json`);
  let X: Float32Array[] = [];
  let Y: Float32Array[] = [];
  if (existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as { X: number[][]; Y: number[][] };
    X = cached.X.map((v) => Float32Array.from(v));
    Y = cached.Y.map((v) => Float32Array.from(v));
    console.log(`Reusing ${X.length} cached boards (${cachePath})`);
  }

  /*
   * Half the cores by default: this runs on somebody's desktop while they are
   * using it, and collection is long enough that taking the whole machine is
   * rude. `BOSS_WORKERS` overrides it.
   */
  const workers = Math.max(1, Number(process.env.BOSS_WORKERS ?? Math.floor(cpus().length / 2)));
  if (X.length === 0) console.log(`Collecting ${SAMPLES} boards on ${workers} workers...`);
  const startedAt = Date.now();
  const per = Math.ceil(SAMPLES / workers);
  const done = new Array<number>(workers).fill(0);
  const parts = await Promise.all(
    Array.from({ length: X.length > 0 ? 0 : workers }, (_, k) => {
      const from = k * per;
      const to = Math.min(SAMPLES, from + per);
      return new Promise<{ X: number[][]; Y: number[][] }>((resolve, reject) => {
        if (from >= to) return resolve({ X: [], Y: [] });
        const worker = new Worker(join(__dirname, 'train-collect.worker.js'), {
          workerData: { from, to, settle: SETTLE_MS, window: WINDOW_MS, seed: 20260913 },
        });
        worker.on('message', (message: { progress?: number; X?: number[][]; Y?: number[][] }) => {
          if (message.progress !== undefined) {
            done[k] = message.progress;
            const total = done.reduce((a, b) => a + b, 0);
            if (total % 96 === 0) {
              const each = (Date.now() - startedAt) / Math.max(1, total);
              console.log(
                `  ${total}/${SAMPLES} (~${(((SAMPLES - total) * each) / 1000).toFixed(0)} s left)`,
              );
            }
            return;
          }
          resolve({ X: message.X!, Y: message.Y! });
        });
        worker.on('error', reject);
      });
    }),
  );
  if (X.length === 0) {
    X = parts.flatMap((p) => p.X).map((v) => Float32Array.from(v));
    Y = parts.flatMap((p) => p.Y).map((v) => Float32Array.from(v));
    console.log(`  collected ${X.length} in ${((Date.now() - startedAt) / 1000).toFixed(0)} s`);
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ X: X.map((v) => [...v]), Y: Y.map((v) => [...v]) }));
  }

  // Standardise on the training split only, so the held-out set stays held out.
  const idx = [...Array(X.length).keys()];
  const test = idx.filter((i) => i % 5 === 0);
  const train = idx.filter((i) => i % 5 !== 0);
  const mean = new Float32Array(inputs);
  const sd = new Float32Array(inputs);
  for (const i of train) for (let d = 0; d < inputs; d += 1) mean[d] += X[i][d] / train.length;
  for (const i of train)
    for (let d = 0; d < inputs; d += 1) sd[d] += (X[i][d] - mean[d]) ** 2 / train.length;
  for (let d = 0; d < inputs; d += 1) sd[d] = Math.sqrt(sd[d]) || 1;
  const Z = idx.map((i) => {
    const v = new Float64Array(inputs);
    for (let d = 0; d < inputs; d += 1) v[d] = (X[i][d] - mean[d]) / sd[d];
    return v;
  });

  /*
   * Ridge regression, solved in the sample space.
   *
   * With 1,299 inputs and ~960 boards the normal equations are the wrong way
   * round: the dual form costs boards-squared instead of inputs-squared and is
   * exactly equivalent. The penalty is not guessed — every value is fitted and
   * scored on data the fit never saw, and the best one is kept.
   */
  const dot = (a: Float64Array, b: Float64Array) => {
    let acc = 0;
    for (let d = 0; d < inputs; d += 1) acc += a[d] * b[d];
    return acc;
  };
  const M = train.length;
  const gram = train.map((a) => {
    const row = new Float64Array(M);
    for (let b = 0; b < M; b += 1) row[b] = dot(Z[a], Z[train[b]]);
    return row;
  });
  const yMean = new Float64Array(OUTPUTS);
  for (const i of train) for (let k = 0; k < OUTPUTS; k += 1) yMean[k] += Y[i][k] / M;

  let flat = 0;
  let flatN = 0;
  for (const i of test)
    for (let k = 0; k < OUTPUTS; k += 1) {
      flat += (yMean[k] - Y[i][k]) ** 2;
      flatN += 1;
    }
  const flatError = Math.sqrt(flat / flatN);

  let best: { lambda: number; error: number; w: Float64Array; b: Float64Array } | null = null;
  for (const lambda of [1, 10, 100, 300, 1000, 3000, 10000, 30000, 100000]) {
    const G = gram.map((row, a) => {
      const r = new Float64Array(M + OUTPUTS);
      r.set(row);
      r[a] += lambda;
      for (let k = 0; k < OUTPUTS; k += 1) r[M + k] = Y[train[a]][k] - yMean[k];
      return r;
    });
    for (let col = 0; col < M; col += 1) {
      let piv = col;
      for (let r = col + 1; r < M; r += 1) if (Math.abs(G[r][col]) > Math.abs(G[piv][col])) piv = r;
      [G[col], G[piv]] = [G[piv], G[col]];
      const d = G[col][col] || 1e-9;
      for (let j = col; j < M + OUTPUTS; j += 1) G[col][j] /= d;
      for (let r = 0; r < M; r += 1) {
        if (r === col) continue;
        const f = G[r][col];
        if (!f) continue;
        for (let j = col; j < M + OUTPUTS; j += 1) G[r][j] -= f * G[col][j];
      }
    }
    // Dual coefficients back to a weight per input, which is what ships.
    const w = new Float64Array(OUTPUTS * inputs);
    for (let a = 0; a < M; a += 1) {
      const z = Z[train[a]];
      for (let k = 0; k < OUTPUTS; k += 1) {
        const alpha = G[a][M + k];
        if (!alpha) continue;
        const row = k * inputs;
        for (let d = 0; d < inputs; d += 1) w[row + d] += alpha * z[d];
      }
    }
    const b = Float64Array.from(yMean);

    let sum = 0;
    let n = 0;
    for (const i of test) {
      for (let k = 0; k < OUTPUTS; k += 1) {
        let p = b[k];
        const row = k * inputs;
        for (let d = 0; d < inputs; d += 1) p += w[row + d] * Z[i][d];
        const clipped = p < 0 ? 0 : p > 1 ? 1 : p;
        sum += (clipped - Y[i][k]) ** 2;
        n += 1;
      }
    }
    const error = Math.sqrt(sum / n);
    console.log(`  lambda ${String(lambda).padStart(6)}: held-out ${error.toFixed(4)}`);
    if (!best || error < best.error) best = { lambda, error, w, b };
  }
  if (!best) throw new Error('no fit');

  console.log(`kept lambda ${best.lambda}`);
  console.log(`  held-out error       ${best.error.toFixed(4)}`);
  console.log(`  ignoring the brain   ${flatError.toFixed(4)}`);
  console.log(
    `  the brain is ${(((flatError - best.error) / flatError) * 100).toFixed(1)} % better`,
  );
  const bestError = best.error;

  const weights: ReadoutWeights = {
    inputs,
    mean: [...mean],
    sd: [...sd],
    w: [...best.w],
    b: [...best.b],
    trainedAt: new Date().toISOString().slice(0, 10),
    samples: SAMPLES,
    heldOutError: Number(bestError.toFixed(5)),
    flatError: Number(flatError.toFixed(5)),
    lambda: best.lambda,
  };
  const target = join(__dirname, '..', 'src', 'modules', 'boss', 'data', 'readout.json');
  writeFileSync(target, JSON.stringify(weights));
  console.log(`wrote ${target}`);

  /*
   * The same weights the interface draws, rounded to two decimals for
   * transport. Written here rather than by hand: the two files drifted apart
   * once already, and a diagram of weights that are not the weights she uses is
   * exactly the kind of thing this project is not allowed to ship.
   */
  const edges = join(
    __dirname,
    '..',
    '..',
    'frontend',
    'src',
    'features',
    'game',
    'data',
    'readout-edges.json',
  );
  const round2 = (values: number[]) => values.map((v) => Number(v.toFixed(3)));
  /*
   * Only the first 64 inputs' weights travel to the browser. The readout runs on
   * all 1,299 descending cells; the diagram labels sixteen of them, and shipping
   * every weight would be a fifth of a megabyte to draw a few hundred lines.
   */
  const SHOWN_INPUTS = Math.min(64, inputs);
  const shownW: number[] = [];
  for (let k = 0; k < OUTPUTS; k += 1) {
    for (let d = 0; d < SHOWN_INPUTS; d += 1) shownW.push(best.w[k * inputs + d]);
  }
  writeFileSync(
    edges,
    `${JSON.stringify({
      inputs,
      shownInputs: SHOWN_INPUTS,
      letters: LETTERS,
      outputs: OUTPUTS,
      w: round2(shownW),
      trainedAt: weights.trainedAt,
      samples: SAMPLES,
      heldOutError: weights.heldOutError,
      flatError: weights.flatError,
      lambda: best.lambda,
      /** How many of the collected boards were worth spending the hint on. */
      hintPositions: Y.filter((y) => y[HINT_OUTPUT] > 0.5).length,
    })}
`,
  );
  console.log(`wrote ${edges}`);

  // The honesty gate: a brain that does not beat a constant is not a brain.
  expect(bestError).toBeLessThan(flatError);
});
