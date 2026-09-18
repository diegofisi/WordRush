import { useUiStore } from '@/shared/stores/useUiStore';

/**
 * The game's sound cues (docs/context/06-v1.1.md -> Sound), synthesised with
 * the Web Audio API: nothing to download, nothing to license.
 *
 * One voice design for all of them: sine and triangle oscillators through a
 * single low-pass filter and a master gain, with a real attack/decay envelope
 * on every note so nothing clicks. The master peak sits at about -14 dBFS
 * (0.2 linear) before the player's own volume, and most cues last under
 * 250 ms. Everything is behind the mute toggle and the volume slider in
 * `useUiStore`; the keyboard tick has its own toggle and is off by default.
 *
 * The cues, in the order of the table in `docs/context/06-v1.1.md -> Sound`:
 * `roomCreated`, `playerJoined`, `playerLeft`, `gameStarted`, `tileReveal`,
 * `keyTap`, `invalidWord`, `letterFound`, `letterPlaced`, `solved`,
 * `rivalSolved`, `penalty`, `timeWarning`, `roundEnded`, `gameWon`,
 * `gameLost`, `sticker`, `chatMessage`, `hintUsed`, and the two room-form
 * cues of 2026-09-17: `optionSelect` (any option changed in the create-room
 * form or the rules dialog: ~40 ms, quieter than everything else) and
 * `settingsSaved` (the rules dialog saved). Those two are room furniture, not
 * typing, so they answer to mute and volume but never to the keyboard toggle.
 *
 * Browsers only let audio start after a user gesture. The context is created
 * lazily on the first cue and, if the browser keeps it suspended, resumed on
 * the next pointer or key event — a cue that fires before that is simply lost,
 * which is the right failure for a notification sound.
 */
export type SoundCue =
  | 'roomCreated'
  | 'playerJoined'
  | 'playerLeft'
  | 'gameStarted'
  | 'tileReveal'
  | 'keyTap'
  | 'invalidWord'
  | 'letterFound'
  | 'letterPlaced'
  | 'solved'
  | 'rivalSolved'
  | 'penalty'
  | 'timeWarning'
  | 'roundEnded'
  | 'gameWon'
  | 'gameLost'
  | 'sticker'
  | 'chatMessage'
  | 'hintUsed'
  | 'optionSelect'
  | 'settingsSaved';

interface Note {
  /** Hz at the start of the note. */
  frequency: number;
  /** Hz at its end, when the note glides. */
  to?: number;
  /** Seconds after the cue starts. */
  at: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
  /** Relative to the master peak (1 = -14 dBFS). */
  gain?: number;
}

interface Cue {
  notes: Note[];
  /**
   * Cues of the same family never overlap: the second one inside
   * `GROUP_GAP_MS` is dropped, so a rival's solve and the -5 s it costs me
   * (they arrive together) sound once, not twice.
   */
  group?: string;
}

/** Master peak before the player's volume: about -14 dBFS. */
const PEAK = 0.2;
const GROUP_GAP_MS = 320;
/** Everything above this is rolled off, which is what keeps the cues soft. */
const LOWPASS_HZ = 3_000;

const CUES: Record<SoundCue, Cue> = {
  // A room exists: a small rising chime.
  roomCreated: {
    notes: [
      { frequency: 523.25, at: 0, duration: 0.1, type: 'triangle' },
      { frequency: 659.25, at: 0.07, duration: 0.1, type: 'triangle' },
      { frequency: 880, at: 0.14, duration: 0.18, gain: 0.9 },
    ],
  },
  // Somebody arrived / left: the same two notes, one up, one down.
  playerJoined: {
    notes: [
      { frequency: 587.33, at: 0, duration: 0.07, gain: 0.8 },
      { frequency: 880, at: 0.06, duration: 0.11, gain: 0.8 },
    ],
    group: 'roster',
  },
  playerLeft: {
    notes: [
      { frequency: 698.46, at: 0, duration: 0.07, gain: 0.7 },
      { frequency: 493.88, at: 0.06, duration: 0.13, gain: 0.7 },
    ],
    group: 'roster',
  },
  // The round is on: four notes up, the only cue over 300 ms.
  gameStarted: {
    notes: [
      { frequency: 523.25, at: 0, duration: 0.1, type: 'triangle' },
      { frequency: 659.25, at: 0.08, duration: 0.1, type: 'triangle' },
      { frequency: 783.99, at: 0.16, duration: 0.1, type: 'triangle' },
      { frequency: 1046.5, at: 0.24, duration: 0.24 },
    ],
  },
  // One per tile during the flip stagger: barely there.
  tileReveal: { notes: [{ frequency: 1174.66, at: 0, duration: 0.035, gain: 0.22 }] },
  // Typing: quieter still, and off unless the player asks for it.
  keyTap: { notes: [{ frequency: 659.25, at: 0, duration: 0.025, gain: 0.16 }] },
  // Not a buzzer: two soft low ticks.
  invalidWord: {
    notes: [
      { frequency: 196, at: 0, duration: 0.06, type: 'triangle', gain: 0.55 },
      { frequency: 174.61, at: 0.09, duration: 0.07, type: 'triangle', gain: 0.55 },
    ],
  },
  // A yellow and a green on the reveal: the same blip, the green brighter.
  letterFound: {
    notes: [{ frequency: 493.88, to: 739.99, at: 0, duration: 0.12, gain: 0.55 }],
    group: 'letter',
  },
  letterPlaced: {
    notes: [{ frequency: 659.25, to: 987.77, at: 0, duration: 0.14, gain: 0.6 }],
    group: 'letter',
  },
  // Solved: a short warm arpeggio.
  solved: {
    notes: [
      { frequency: 523.25, at: 0, duration: 0.1, type: 'triangle' },
      { frequency: 659.25, at: 0.07, duration: 0.1, type: 'triangle' },
      { frequency: 783.99, at: 0.14, duration: 0.1, type: 'triangle' },
      { frequency: 1046.5, at: 0.21, duration: 0.26 },
    ],
  },
  // Somebody else solved, and the -5 s it costs me: one falling two-note.
  rivalSolved: {
    notes: [
      { frequency: 587.33, at: 0, duration: 0.09, type: 'triangle', gain: 0.8 },
      { frequency: 440, at: 0.09, duration: 0.16, type: 'triangle', gain: 0.8 },
    ],
    group: 'penalty',
  },
  penalty: {
    notes: [
      { frequency: 440, at: 0, duration: 0.09, type: 'triangle', gain: 0.85 },
      { frequency: 293.66, at: 0.09, duration: 0.18, type: 'triangle', gain: 0.85 },
    ],
    group: 'penalty',
  },
  // 10 s left, then every one of the last five.
  timeWarning: { notes: [{ frequency: 880, at: 0, duration: 0.05, gain: 0.5 }] },
  roundEnded: {
    notes: [
      { frequency: 659.25, at: 0, duration: 0.12, type: 'triangle' },
      { frequency: 523.25, at: 0.12, duration: 0.24, type: 'triangle' },
    ],
  },
  gameWon: {
    notes: [
      { frequency: 523.25, at: 0, duration: 0.11, type: 'triangle' },
      { frequency: 659.25, at: 0.09, duration: 0.11, type: 'triangle' },
      { frequency: 783.99, at: 0.18, duration: 0.11, type: 'triangle' },
      { frequency: 1046.5, at: 0.27, duration: 0.32 },
    ],
    group: 'final',
  },
  gameLost: {
    notes: [
      { frequency: 440, at: 0, duration: 0.13, type: 'triangle' },
      { frequency: 369.99, at: 0.13, duration: 0.13, type: 'triangle' },
      { frequency: 293.66, at: 0.26, duration: 0.3, type: 'triangle' },
    ],
    group: 'final',
  },
  // A sticker landing: a little pop.
  sticker: { notes: [{ frequency: 880, to: 1396.91, at: 0, duration: 0.06, gain: 0.6 }] },
  // Somebody else wrote: one soft ping.
  chatMessage: { notes: [{ frequency: 1046.5, at: 0, duration: 0.09, gain: 0.45 }] },
  hintUsed: {
    notes: [
      { frequency: 783.99, at: 0, duration: 0.08, gain: 0.7 },
      { frequency: 1046.5, at: 0.07, duration: 0.14, gain: 0.7 },
    ],
    group: 'hint',
  },
  // Picking an option in a room form: the softest cue of the set, one short
  // click. A host walking down the settings hears a rhythm, not a fanfare.
  optionSelect: { notes: [{ frequency: 987.77, at: 0, duration: 0.04, gain: 0.2 }] },
  // The rules were saved: two quick soft notes, up.
  settingsSaved: {
    notes: [
      { frequency: 659.25, at: 0, duration: 0.07, gain: 0.5 },
      { frequency: 987.77, at: 0.07, duration: 0.12, gain: 0.5 },
    ],
    group: 'settings',
  },
};

let context: AudioContext | null = null;
let master: GainNode | null = null;
let unlockArmed = false;
const lastPlayed = new Map<string, number>();

const build = (): AudioContext | null => {
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = LOWPASS_HZ;
  filter.Q.value = 0.5;
  master = context.createGain();
  master.gain.value = 1;
  master.connect(filter);
  filter.connect(context.destination);
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

const playNote = (ctx: AudioContext, out: GainNode, note: Note, volume: number) => {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  const start = ctx.currentTime + note.at;
  const peak = Math.max(0.0002, PEAK * (note.gain ?? 1) * volume);
  // A short attack and a decay over the rest of the note: an envelope, not a
  // gate, which is what keeps every cue free of clicks.
  const attack = Math.min(0.012, note.duration * 0.4);
  oscillator.type = note.type ?? 'sine';
  oscillator.frequency.setValueAtTime(note.frequency, start);
  if (note.to !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(note.to, start + note.duration);
  }
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
  oscillator.connect(envelope);
  envelope.connect(out);
  oscillator.start(start);
  oscillator.stop(start + note.duration + 0.03);
};

declare global {
  interface Window {
    /** Dev only: every cue asked for, in order, for the verification runs. */
    __wordrushSound?: SoundCue[];
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') window.__wordrushSound = [];

/** Plays a cue unless the player muted the game. Safe to call from stores. */
export const playSound = (cue: SoundCue): void => {
  if (import.meta.env.DEV) window.__wordrushSound?.push(cue);
  const { muted, volume, keyboardSounds } = useUiStore.getState();
  if (muted || volume <= 0) return;
  if (cue === 'keyTap' && !keyboardSounds) return;

  const spec = CUES[cue];
  if (spec.group) {
    const now = Date.now();
    const last = lastPlayed.get(spec.group) ?? 0;
    if (now - last < GROUP_GAP_MS) return;
    lastPlayed.set(spec.group, now);
  }

  const ctx = build();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') {
    armUnlock(ctx);
    return;
  }
  for (const note of spec.notes) playNote(ctx, master, note, volume);
};

/** One short tick per tile of a flip stagger; the board calls it on a reveal. */
export const playTileReveal = (tiles: number, staggerMs: number): void => {
  for (let index = 0; index < tiles; index += 1) {
    window.setTimeout(() => playSound('tileReveal'), index * staggerMs);
  }
};
