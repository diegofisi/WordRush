import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BossMove,
  BossSituation,
  IBossBrain,
} from '../domain/interfaces/boss-brain.interface';
import { LetterReadout, type ReadoutWeights } from '../domain/services/letter-readout';
import { BrainWorkerService } from './brain-worker.service';

/**
 * The fly, thinking with a real brain.
 *
 * Her board goes in as Poisson drive on real visual populations, 138,639
 * FlyWire neurons integrate and fire for 150 ms of biological time, and the
 * firing rates of 64 real descending cells come back. A trained readout turns
 * those rates into the letters she wants; the board then plays the legal word
 * that matches them best.
 *
 * The action she takes still comes from the policy: choosing between risking a
 * word and probing for letters is a decision about the rules of a game, and
 * claiming a fly brain makes it would be the kind of dressing-up this project
 * keeps refusing. What the brain decides is the word.
 */
@Injectable()
export class ConnectomeBossBrain implements IBossBrain {
  private readonly logger = new Logger(ConnectomeBossBrain.name);
  private readout: LetterReadout | null = null;
  private warned = false;

  constructor(private readonly worker: BrainWorkerService) {
    const file = join(__dirname, '..', 'data', 'readout.json');
    if (existsSync(file)) {
      const weights = JSON.parse(readFileSync(file, 'utf8')) as ReadoutWeights;
      this.readout = new LetterReadout(weights);
      this.logger.log(
        `Readout loaded: ${weights.inputs} descending cells, trained ${weights.trainedAt} ` +
          `on ${weights.samples} samples (held-out error ${weights.heldOutError})`,
      );
    } else {
      this.logger.warn('No trained readout found; run tools/train-boss-readout.spec.ts');
    }
  }

  describe(): string {
    const info = this.worker.ready;
    if (!info || !this.readout) return 'no brain';
    return `FlyWire 783 · ${info.neurons.toLocaleString()} neurons · ${info.edges.toLocaleString()} synapses`;
  }

  async decide(situation: BossSituation): Promise<BossMove> {
    if (!this.readout) return SILENT;

    const response = await this.worker.ask({
      slots: situation.slots,
      letters: situation.letters,
      seed: situation.seed,
    });

    if (!response || response.rates.length === 0) {
      if (!this.warned) {
        this.logger.warn('Brain unavailable; the fly makes no move');
        this.warned = true;
      }
      return SILENT;
    }

    const preference = this.readout.run(Float32Array.from(response.rates));
    return {
      action: 'guess',
      confidence: confidenceOf(this.readout.wanted),
      hintWant: this.readout.hintWant,
      // What the board changed, not the raw preference: the word choice has to
      // see only the part her brain read off this board.
      letterPreference: Float32Array.from(this.readout.wanted),
      rates: response.rates,
      biologicalMs: response.biologicalMs,
      wallMs: response.wallMs,
      telemetry: {
        ...response.telemetry,
        neurons: this.worker.ready?.neurons ?? 0,
        synapses: this.worker.ready?.edges ?? 0,
        letterPreference: [...preference].map((v) => Math.round(v * 1000) / 1000),
        // The panel draws a slice; the readout ran on all of them.
        descending: response.rates.slice(0, 64).map((v) => Math.round(v)),
      },
    };
  }
}

/** She did not move. Nothing stands in for the brain when it is not there. */
const SILENT: BossMove = {
  action: 'guess',
  confidence: 0,
  hintWant: 0,
  letterPreference: null,
  rates: [],
  biologicalMs: 0,
  wallMs: 0,
  telemetry: null,
};

/**
 * How sure her readout was, measured on its own outputs: how far the letter it
 * wanted most this board stands above the spread of the rest.
 *
 * It used to come from the policy's own thresholds, which meant the number the
 * room saw as "her confidence" had never been near a neuron.
 */
function confidenceOf(wanted: Float32Array): number {
  let sum = 0;
  let top = -Infinity;
  for (const value of wanted) {
    sum += value;
    if (value > top) top = value;
  }
  const mean = sum / wanted.length;
  let variance = 0;
  for (const value of wanted) variance += (value - mean) ** 2;
  const sd = Math.sqrt(variance / wanted.length);
  if (sd <= 0) return 0;
  // Three standard deviations above the rest reads as certain.
  return Math.max(0, Math.min(1, (top - mean) / (3 * sd)));
}
