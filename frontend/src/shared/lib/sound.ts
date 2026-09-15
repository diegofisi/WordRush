/**
 * The game's cues, synthesised.
 *
 * There are no audio files on purpose: a handful of short tones weighs nothing,
 * needs no attribution and cannot arrive late over the network at the exact
 * moment a round starts. Everything here is a couple of oscillators and an
 * envelope.
 *
 * Every cue marks something the player would otherwise have to watch for: the
 * round opening, their clock running low, a hit landing on them, the round and
 * the game closing. Nothing plays for decoration.
 */

export type Cue =
  /** The round just opened. */
  | 'start'
  /** You solved it. */
  | 'solved'
  /** Your clock crossed the low-time line. */
  | 'lowTime'
  /** One of the last few seconds went by. */
  | 'tick'
  /** Somebody's solve took time off your clock. */
  | 'hit'
  /** The round closed. */
  | 'roundEnd'
  /** The game closed. */
  | 'gameEnd';

interface Note {
  /** Hz at the start of the note. */
  freq: number;
  /** Hz it slides to, when it slides. */
  to?: number;
  /** Seconds after the cue begins. */
  at: number;
  /** Seconds long. */
  length: number;
  /** Peak of the envelope, 0..1, before the master volume. */
  gain?: number;
  type?: OscillatorType;
}

/** Each cue as a short phrase. Frequencies are a plain major scale. */
const CUES: Record<Cue, Note[]> = {
  start: [
    { freq: 523.25, at: 0, length: 0.12 },
    { freq: 659.25, at: 0.1, length: 0.12 },
    { freq: 783.99, at: 0.2, length: 0.26, gain: 0.9 },
  ],
  solved: [
    { freq: 659.25, at: 0, length: 0.1 },
    { freq: 830.61, at: 0.08, length: 0.1 },
    { freq: 987.77, at: 0.16, length: 0.1 },
    { freq: 1318.51, at: 0.24, length: 0.34, gain: 0.85 },
  ],
  // Two flat, urgent beeps: this one has to read as a warning, not a reward.
  lowTime: [
    { freq: 880, at: 0, length: 0.09, type: 'square', gain: 0.45 },
    { freq: 880, at: 0.16, length: 0.09, type: 'square', gain: 0.45 },
  ],
  tick: [{ freq: 1046.5, at: 0, length: 0.045, type: 'square', gain: 0.3 }],
  // Falling and short: something was taken from you.
  hit: [{ freq: 320, to: 150, at: 0, length: 0.22, type: 'sawtooth', gain: 0.5 }],
  roundEnd: [
    { freq: 587.33, at: 0, length: 0.14 },
    { freq: 440, at: 0.13, length: 0.3, gain: 0.8 },
  ],
  gameEnd: [
    { freq: 523.25, at: 0, length: 0.16 },
    { freq: 659.25, at: 0.15, length: 0.16 },
    { freq: 783.99, at: 0.3, length: 0.16 },
    { freq: 1046.5, at: 0.45, length: 0.5, gain: 0.9 },
  ],
};

const MASTER = 0.16;

let context: AudioContext | null = null;
let muted = false;

/** The browser only allows audio after a gesture; this is called on the first one. */
function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

export const sound = {
  setMuted(value: boolean): void {
    muted = value;
  },

  /**
   * Opens the audio device off the back of a real gesture. Browsers refuse to
   * start one otherwise, and the first cue would be swallowed silently.
   */
  unlock(): void {
    if (muted) return;
    ensureContext();
  },

  play(cue: Cue): void {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    for (const note of CUES[cue]) {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = note.type ?? 'triangle';
      const start = now + note.at;
      const end = start + note.length;
      oscillator.frequency.setValueAtTime(note.freq, start);
      if (note.to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(note.to, end);

      // A short attack and an exponential tail: a square wave cut off squarely
      // clicks, and the click is louder than the note.
      const peak = MASTER * (note.gain ?? 1);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(envelope).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  },
};
