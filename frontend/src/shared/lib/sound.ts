import { useUiStore } from '@/shared/stores/useUiStore';

/**
 * The game's four sound cues (docs/context/06-v1.1.md -> Sound), synthesised
 * with the Web Audio API so there is nothing to download and nothing to license.
 * Everything sits behind the mute toggle in `useUiStore`; players cannot send
 * sounds and nothing else in the game makes noise.
 *
 * Browsers only let audio start after a user gesture. The context is created
 * lazily on the first cue and, if the browser keeps it suspended, resumed on
 * the next pointer or key event — a cue that fires before that is simply lost,
 * which is the right failure for a notification sound.
 */
export type SoundCue = 'roomCreated' | 'playerJoined' | 'gameStarted' | 'roundEnded';

interface Note {
  /** Hz. */
  frequency: number;
  /** Seconds after the cue starts. */
  at: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

/** Short, distinct, and quiet: a chime, a tap, a rising three-note call, a falling close. */
const CUES: Record<SoundCue, Note[]> = {
  roomCreated: [
    { frequency: 660, at: 0, duration: 0.12 },
    { frequency: 880, at: 0.12, duration: 0.2 },
  ],
  playerJoined: [{ frequency: 740, at: 0, duration: 0.09, type: 'triangle' }],
  gameStarted: [
    { frequency: 523, at: 0, duration: 0.11 },
    { frequency: 659, at: 0.12, duration: 0.11 },
    { frequency: 784, at: 0.24, duration: 0.22 },
  ],
  roundEnded: [
    { frequency: 659, at: 0, duration: 0.14 },
    { frequency: 523, at: 0.15, duration: 0.26 },
  ],
};

let context: AudioContext | null = null;
let unlockArmed = false;

const getContext = (): AudioContext | null => {
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  return context;
};

/** Resumes a suspended context on the next gesture, once. */
const armUnlock = (ctx: AudioContext) => {
  if (unlockArmed) return;
  unlockArmed = true;
  const resume = () => {
    void ctx.resume();
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
};

const playNote = (ctx: AudioContext, note: Note) => {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  const start = ctx.currentTime + note.at;
  const peak = note.gain ?? 0.08;
  oscillator.type = note.type ?? 'sine';
  oscillator.frequency.setValueAtTime(note.frequency, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
  oscillator.connect(envelope);
  envelope.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + note.duration + 0.02);
};

/** Plays a cue unless the player muted the game. Safe to call from stores. */
export const playSound = (cue: SoundCue): void => {
  if (useUiStore.getState().muted) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    armUnlock(ctx);
    return;
  }
  for (const note of CUES[cue]) playNote(ctx, note);
};
