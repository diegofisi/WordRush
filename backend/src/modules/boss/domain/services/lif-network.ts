import type { Connectome } from './connectome';

/**
 * Leaky integrate-and-fire over the connectome, with the parameters of the
 * Shiu et al. model that the published fly-brain demos use.
 *
 * Nothing here is tuned for the game. A neuron leaks towards rest, sums what
 * arrives, fires when it crosses threshold and then cannot fire again for the
 * refractory period. The wiring decides everything else.
 */
export const LIF = {
  /** mV */
  rest: -52,
  threshold: -45,
  reset: -52,
  /** ms */
  tau: 5,
  refractory: 2.2,
  step: 0.1,
} as const;

const DECAY = LIF.step / LIF.tau;

/** A Poisson event large enough to take a resting sensory neuron over threshold. */
export const STIMULUS_MV = 8;

export interface StimulusChannel {
  /** Neurons this channel drives. */
  neurons: Int32Array;
  /** Spikes per second injected into each of them. */
  rate: number;
}

/** Deterministic RNG so a replay of the same seed gives the same trace. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class LifNetwork {
  private readonly voltage: Float32Array;
  private readonly refractory: Float32Array;
  private readonly input: Float32Array;
  readonly spiked: Uint8Array;
  /** Spikes per neuron since the last `resetCounts`. */
  readonly spikeCount: Int32Array;
  /** Excitatory and inhibitory mV delivered since the last `resetCounts`. */
  excitatory = 0;
  inhibitory = 0;

  constructor(
    private readonly connectome: Connectome,
    private readonly random: () => number = Math.random,
  ) {
    const n = connectome.neurons;
    this.voltage = new Float32Array(n);
    this.refractory = new Float32Array(n);
    this.input = new Float32Array(n);
    this.spiked = new Uint8Array(n);
    this.spikeCount = new Int32Array(n);
    this.reset();
  }

  reset(): void {
    this.voltage.fill(LIF.rest);
    this.refractory.fill(0);
    this.input.fill(0);
    this.spiked.fill(0);
    this.spikeCount.fill(0);
  }

  resetCounts(): void {
    this.spikeCount.fill(0);
    this.excitatory = 0;
    this.inhibitory = 0;
  }

  /** Distribution of membrane voltage right now, over every neuron. */
  voltageHistogram(bins: number, low = -54, high = -43): Int32Array {
    const out = new Int32Array(bins);
    const scale = bins / (high - low);
    for (let i = 0; i < this.voltage.length; i += 1) {
      let k = Math.floor((this.voltage[i] - low) * scale);
      if (k < 0) k = 0;
      if (k >= bins) k = bins - 1;
      out[k] += 1;
    }
    return out;
  }

  /** Which of `neurons` fired at least once since `resetCounts`. */
  firedAmong(neurons: Int32Array): number[] {
    const out: number[] = [];
    for (let k = 0; k < neurons.length; k += 1) {
      if (this.spikeCount[neurons[k]] > 0) out.push(k);
    }
    return out;
  }

  /** One 0.1 ms step. Returns how many neurons fired. */
  step(channels: readonly StimulusChannel[]): number {
    const { indptr, indices, weights, neurons } = this.connectome;
    const { voltage, refractory, input, spiked, spikeCount } = this;

    for (const channel of channels) {
      if (channel.rate <= 0) continue;
      const probability = channel.rate * LIF.step * 0.001;
      for (let k = 0; k < channel.neurons.length; k += 1) {
        if (this.random() < probability) input[channel.neurons[k]] += STIMULUS_MV;
      }
    }

    let fired = 0;
    for (let i = 0; i < neurons; i += 1) {
      spiked[i] = 0;
      if (refractory[i] > 0) {
        refractory[i] -= LIF.step;
        voltage[i] = LIF.reset;
        input[i] = 0;
        continue;
      }
      voltage[i] += (LIF.rest - voltage[i]) * DECAY + input[i];
      input[i] = 0;
      if (voltage[i] >= LIF.threshold) {
        voltage[i] = LIF.reset;
        refractory[i] = LIF.refractory;
        spiked[i] = 1;
        spikeCount[i] += 1;
        fired += 1;
      }
    }

    // Propagation lands on the next step: one step of synaptic delay.
    if (fired > 0) {
      for (let i = 0; i < neurons; i += 1) {
        if (!spiked[i]) continue;
        for (let e = indptr[i], to = indptr[i + 1]; e < to; e += 1) {
          const w = weights[e];
          input[indices[e]] += w;
          if (w >= 0) this.excitatory += w;
          else this.inhibitory -= w;
        }
      }
    }
    return fired;
  }

  /** Runs `milliseconds` of biological time. */
  run(channels: readonly StimulusChannel[], milliseconds: number): number {
    const steps = Math.round(milliseconds / LIF.step);
    let fired = 0;
    for (let s = 0; s < steps; s += 1) fired += this.step(channels);
    return fired;
  }

  /**
   * Like `run`, but records when each of `watch` fired, in biological ms from
   * the start of the window. This is the spike raster, straight from the model.
   */
  runRecording(
    channels: readonly StimulusChannel[],
    milliseconds: number,
    watch: Int32Array,
  ): { fired: number; raster: number[][] } {
    const steps = Math.round(milliseconds / LIF.step);
    const raster: number[][] = watch ? Array.from(watch, () => [] as number[]) : [];
    let fired = 0;
    for (let s = 0; s < steps; s += 1) {
      fired += this.step(channels);
      for (let k = 0; k < watch.length; k += 1) {
        if (this.spiked[watch[k]]) raster[k].push(Math.round(s * LIF.step * 10) / 10);
      }
    }
    return { fired, raster };
  }

  /** Firing rate in Hz of the given neurons over a window of `milliseconds`. */
  ratesOf(neurons: Int32Array, milliseconds: number, out: Float32Array): Float32Array {
    const seconds = milliseconds / 1000;
    for (let k = 0; k < neurons.length; k += 1) out[k] = this.spikeCount[neurons[k]] / seconds;
    return out;
  }
}
