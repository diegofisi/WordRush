/**
 * WordRush socket contract.
 *
 * OWNER: backend. The frontend keeps a byte-identical copy at
 * `frontend/src/shared/contract/index.ts`, refreshed with
 * `node scripts/sync-contract.mjs` from the repo root. Never edit the copy.
 *
 * Rules and scoring are documented in `docs/context/`; the numbers below are
 * the single place they are encoded.
 */

export const CONTRACT_VERSION = 18;

export type Language = 'es' | 'en';
export type TileColor = 'green' | 'yellow' | 'gray';
export type Emote =
  | 'love'
  | 'wink'
  | 'tease'
  | 'mindblown'
  | 'shock'
  | 'explode'
  | 'oops'
  | 'whoa'
  | 'ez'
  | 'done'
  | 'clutch'
  | 'gg'
  | 'lol'
  | 'grumpy'
  | 'thumbs'
  | 'luck'
  | 'point'
  | 'shrug'
  | 'ok'
  | 'shh';
export type RoomStatus = 'lobby' | 'playing' | 'between-rounds' | 'finished';

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 8;
/** Picker order: the 5x4 grid reads row by row in this order. */
export const EMOTES: readonly Emote[] = [
  'love',
  'wink',
  'tease',
  'mindblown',
  'shock',
  'explode',
  'oops',
  'whoa',
  'ez',
  'done',
  'clutch',
  'gg',
  'lol',
  'grumpy',
  'thumbs',
  'luck',
  'point',
  'shrug',
  'ok',
  'shh',
];

export const ROOM_LIMITS = {
  minPlayers: 2,
  maxPlayers: 8,
  minInitialSeconds: 60,
  maxInitialSeconds: 300,
  initialSecondsOptions: [60, 90, 120, 180] as const,
  minRounds: 1,
  maxRounds: 10,
  roundsOptions: [1, 3, 5, 10] as const,
  nameMinLength: 1,
  nameMaxLength: 16,
  betweenRoundsSeconds: 12,
  /** Emote burst limit: more than 8 sends inside 3 s pauses the player for 5 s. */
  emoteBurstLimit: 8,
  emoteBurstWindowSeconds: 3,
  emotePauseSeconds: 5,
} as const;

/**
 * Boss mode: the room against the fly. docs/context/06-boss-mode.md
 *
 * The fly is a seat in the room that plays the same word under the same rules,
 * with two deliberate exceptions encoded here: the attack points at her instead
 * of at other humans, and her clock never goes up.
 */
export const BOSS = {
  /** Display name of the seat. The interface localises it; this is the fallback. */
  name: 'Mosca',
  /**
   * Kept only so an older client still parses. **She now plays on the room's own
   * clock**, the same `initialSeconds` as every human, decided on 2026-09-13:
   * a separate 45 s bar made her look permanently strangled and made her score
   * incomparable. See `bossClockSeconds` below.
   */
  baseSeconds: 0,
  secondsPerHuman: 0,
  /**
   * Seconds a human solve takes off her. Harder than the 5 s of the normal
   * game on purpose: measured on 2026-09-13, a 5 s hit left her winning every
   * scenario even with the whole room solving instantly, which no real room
   * does. At 8 s a solve is worth taking a risk for.
   */
  damageOnHumanSolve: 8,
  /**
   * She earns time from letters at the normal rates, like anybody else. The
   * exception that used to sit here existed only to make a short health bar
   * drainable; on the room's own clock it is not needed and it made her a
   * different kind of player from everyone she was playing against.
   */
  earnsTimeFromLetters: true,
  /** Flat points for every human still seated when she goes down. */
  defeatedBonus: 25,
  /** Boss mode allows a solo run; the normal game needs two humans. */
  minHumans: 1,
  /**
   * Her attempts per round. Fewer than a human's 8, and that is what makes her
   * brain matter: measured on 2026-09-14, a fly choosing at random among the
   * words still compatible with her colours solves 98.6% of rounds in 8
   * attempts — no room left for a brain to add anything — and 47.7% in 4,
   * against 74.5% for the best achievable choice. Four is where her choice
   * decides the round (docs/context/07-what-the-fly-can-do.md).
   */
  maxAttempts: 4,
  /**
   * How many compatible words she is shown each turn, drawn at random. Her
   * output pathway carries about two independent quantities on the boards a
   * game produces; choosing one of eight is a decision that fits through it,
   * choosing one of ten thousand is not.
   */
  candidates: 8,
} as const;

/** What the fly can do with a turn. */
/**
 * She has exactly one move: play the word her brain asked for.
 *
 * There used to be four — probe, commit, hint, wait — chosen by hand-written
 * thresholds over the candidate count. That was a policy playing the game, not
 * the fly, so it is gone (docs/context/06-boss-mode.md, 2026-09-13).
 */
export type BossAction = 'guess';

/**
 * Her starting clock: the room's, exactly like a human's.
 *
 * She used to get a short flat bar of her own. It read as permanent near-death
 * and, worse, it broke her scoring: the points formula pays for the percentage
 * of *your* clock you had left, so a 45 s opponent measured against a 90 s room
 * could never score fairly and had to be dropped from the table. Same clock,
 * same formula, same table (docs/context/06-boss-mode.md).
 */
export function bossClockSeconds(initialSeconds: number): number {
  return initialSeconds;
}

/** docs/context/02-game-rules.md and 03-scoring-system.md */
export const SCORING = {
  yellowSeconds: 5,
  greenSeconds: 10,
  greenAfterYellowSeconds: 5,
  greenAfterHintSeconds: 5,
  penaltyOnRivalSolveSeconds: 5,
  attemptPenalty: 2,
  positionBonus: [20, 15, 10] as const,
  hintKeptBonus: 10,
  solveBonus: 40,
  pointsPerGreenUnsolved: 8,
  pointsPerYellowUnsolved: 4,
} as const;

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface RoomSettings {
  language: Language;
  initialSeconds: number;
  rounds: number;
  capacity: number;
  hintEnabled: boolean;
  /** The room plays against the fly instead of against each other. */
  bossMode: boolean;
}

export interface PlayerPublic {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  /** The fly's seat. Never occupies a human slot and never hosts. */
  isBot: boolean;
}

export interface LobbyState {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: PlayerPublic[];
}

/** What everyone sees about a player during a round: colours only, never letters. */
export interface PlayerProgress {
  playerId: string;
  rows: TileColor[][];
  attempt: number;
  /** Seconds left at `at`; the client derives the countdown from these two. */
  secondsLeft: number;
  at: number;
  solved: boolean;
  solvedPosition: number | null;
  /** Solved, out of attempts, or out of time. */
  finished: boolean;
  hintUsed: boolean;
  greens: number;
  /** Answer slots known to be in the word (yellow or hinted) but never turned green. */
  yellows: number;
  /** Seconds lost to rivals' solves this round. */
  penaltySeconds: number;
}

/** The player's own rows, letters included. */
export interface OwnRow {
  word: string;
  colors: TileColor[];
}

/** The hint reveals a letter that is in the word, never its position. */
export interface HintReveal {
  letter: string;
  /** How many times `letter` occurs in the answer (1..WORD_LENGTH). */
  count: number;
}

export type GainKind = 'yellow' | 'green' | 'green-after-yellow' | 'green-after-hint';

export interface LetterGain {
  letter: string;
  position: number;
  kind: GainKind;
  seconds: number;
}

export interface SelfState {
  rows: OwnRow[];
  secondsLeft: number;
  at: number;
  solved: boolean;
  finished: boolean;
  hintUsed: boolean;
  hint: HintReveal | null;
  penaltySeconds: number;
}

export interface RoundInfo {
  round: number;
  totalRounds: number;
  initialSeconds: number;
  startedAt: number;
  hintAvailable: boolean;
}

/** The fly's clock as a health bar. Null outside boss mode. */
export interface BossState {
  playerId: string;
  /** Where her clock started this round, before any damage. */
  startSeconds: number;
  /** Seconds the team has taken off her so far. */
  damageSeconds: number;
  secondsLeft: number;
  at: number;
  attempt: number;
  solved: boolean;
  /** Out of clock or out of attempts without solving. */
  defeated: boolean;
  /**
   * What she would have earned from her letters under the normal rules. Shown
   * greyed out so the no-healing rule reads as a handicap, not a missing feature.
   */
  forfeitedSeconds: number;
  /** Her last decision, or null before she has taken a turn. */
  decision: BossDecisionState | null;
}

/**
 * What she decided and how sure she was. Measured from the policy that chose
 * the move, never invented: `confidence` is the margin the decision was made by.
 * Nothing here names a letter or a word.
 */
export interface BossDecisionState {
  action: BossAction;
  /**
   * How strongly her readout wanted its top letter over the rest, 0..1. It is
   * measured on the readout's own 27 outputs; nothing outside the brain has a
   * say in it.
   */
  confidence: number;
  /**
   * How much her readout wanted to spend the hint this turn, 0..1. It is an
   * output of the readout like the letters are, so *when* to spend it is
   * something she learnt rather than something a threshold decided.
   */
  hintWant: number;
  /** True when she actually spent it this turn. */
  hintSpent: boolean;
  attempt: number;
  /**
   * The letters her readout wanted most this turn, strongest first. This is
   * what chose the word: the board played the legal word that best spends them.
   * Empty only when the brain did not answer, in which case she does not move.
   */
  letters: string[];
  /** True when a real simulation produced this move. */
  brain: boolean;
  /**
   * The word she is typing this turn, so the 3-D fly presses the keys she is
   * really pressing instead of miming. The room decided on 2026-09-13 that
   * watching her type is fair: at four letters a second nobody reads it, and
   * her board is already visible in colour.
   */
  typing: string;
  /** Milliseconds of biological time simulated, and what they cost in wall time. */
  biologicalMs: number;
  wallMs: number;
  /** What the brain did while it decided. Null when it was not the brain deciding. */
  telemetry: BossTelemetry | null;
}

/**
 * Everything the instrument draws, read off the running model. None of it is
 * generated for the interface: the raster is her spike times, the histogram is
 * every neuron's membrane voltage, the rates are counted spikes.
 * docs/context/06-boss-mode.md
 */
export interface BossTelemetry {
  /** Spike times in biological ms, one row per watched descending cell. */
  raster: number[][];
  /** Membrane voltage across the whole brain, 26 bins from -54 to -43 mV. */
  voltage: number[];
  /** Firing rate in Hz per neuron, by FlyWire anatomical class. */
  populations: { name: string; hz: number }[];
  /** Excitatory and inhibitory mV delivered during the window. */
  excitatory: number;
  inhibitory: number;
  /** Which of the sampled neurons fired, as indices into the shared sample. */
  cloud: number[];
  /** Poisson rate injected per board channel, in Hz. */
  stimulus: number[];
  /** Size of the brain that produced this. */
  neurons: number;
  synapses: number;
  /** Its 27 outputs: how much she wants each letter of the alphabet, 0..1. */
  letterPreference: number[];
  /** Firing rate in Hz of every readout cell, the diagram's input column. */
  descending: number[];
}

/**
 * A live frame of her brain, several times a second while somebody is watching.
 *
 * The decision telemetry is a single snapshot per turn, which reads as frozen
 * between guesses. Her brain does not switch off between guesses, so neither
 * does this: the simulation keeps running on whatever she is looking at and
 * streams what it is doing. Only rooms with a watcher get it.
 */
export interface BossFrame {
  /**
   * How hard each sampled neuron fired this slice: two bits per neuron, 0 to 3
   * spikes, base64. Graded rather than on/off, so the cloud separates a cell
   * that fired once from one that fired three times.
   */
  cloud: string;
  /** Membrane voltage across the whole brain, 26 bins. */
  voltage: number[];
  /** Firing rate in Hz per neuron, by anatomical class. */
  populations: number[];
  /** Spike times of the watched descending cells inside this slice, in ms. */
  raster: number[][];
  /** Their firing rate in Hz, the network diagram's input column. */
  descending: number[];
  /** What her brain wants each letter to be worth right now, 0..1. */
  letters: number[];
  /** Excitatory and inhibitory mV delivered in this slice. */
  excitatory: number;
  inhibitory: number;
  /** Biological ms covered by this slice, and the wall ms it cost. */
  biologicalMs: number;
  wallMs: number;
}

/** How the fly ended her round. She is the opponent, so she is not scored. */
export interface BossSummary {
  solved: boolean;
  attempts: number;
  /** Out of clock or out of attempts without solving. */
  defeated: boolean;
  secondsLeft: number;
  /**
   * Every word she played, with its colours. Only ever sent once the round is
   * over: while it runs, nobody sees a letter of hers.
   */
  rows: { word: string; colors: TileColor[] }[];
}

export interface RoundState extends RoundInfo {
  me: SelfState;
  players: PlayerProgress[];
  boss: BossState | null;
}

export interface RoundBreakdown {
  playerId: string;
  name: string;
  solved: boolean;
  attempt: number;
  position: number | null;
  /** Percent of the initial time left at solve; null when not solved. */
  timeLeftPercent: number | null;
  timePoints: number;
  /** Flat bonus for solving the word; 0 when not solved. */
  solveBonus: number;
  attemptPenalty: number;
  positionBonus: number;
  hintBonus: number;
  greens: number;
  greenPoints: number;
  /** Answer slots known but never turned green; only pays when not solved. */
  yellows: number;
  yellowPoints: number;
  /** Flat team bonus when the fly went down this round; 0 otherwise. */
  bossBonus: number;
  roundPoints: number;
}

export interface Standing {
  playerId: string;
  name: string;
  total: number;
  attempts: number;
  hintsUsed: number;
  rank: number;
}

export interface RoundEndPayload {
  round: number;
  totalRounds: number;
  word: string;
  breakdown: RoundBreakdown[];
  standings: Standing[];
  /** Seconds until the next round starts automatically; 0 when the game ended. */
  nextRoundIn: number;
  /** True when the team beat the fly, false when she solved. Null outside boss mode. */
  bossDefeated: boolean | null;
  /**
   * How the fly finished. She is the boss, not a competitor: she is absent from
   * `breakdown` and `standings` because a clock that doubles as health can never
   * score fairly against a clock that only counts down (docs/context/06-boss-mode.md).
   */
  boss: BossSummary | null;
}

export interface GameEndPayload {
  standings: Standing[];
  rounds: number;
}

export interface FullState {
  lobby: LobbyState;
  round: RoundState | null;
  lastRoundEnd: RoundEndPayload | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'room_not_found'
  | 'room_full'
  | 'game_in_progress'
  | 'name_taken'
  | 'invalid_payload'
  | 'not_host'
  | 'not_enough_players'
  | 'not_in_round'
  | 'already_finished'
  | 'word_length'
  | 'word_not_in_list'
  | 'hint_unavailable'
  | 'hint_already_used'
  | 'cooldown'
  | 'not_in_room'
  | 'already_in_room'
  | 'session_expired'
  | 'internal';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export type Ack<T> = ({ ok: true } & T) | ({ ok: false } & ErrorPayload);
/** Ack of events that return no data. */
export type EmptyAck = { ok: true } | ({ ok: false } & ErrorPayload);

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export interface CreateRoomPayload {
  name: string;
  settings: RoomSettings;
}

export interface JoinRoomPayload {
  roomCode: string;
  name: string;
}

export interface RejoinPayload {
  roomCode: string;
  playerId: string;
  /** Secret handed out on create/join; proves ownership of the playerId. */
  token: string;
}

export interface GuessPayload {
  word: string;
}

export interface ReactionPayload {
  emote: Emote;
}

/** Host-only, lobby-only edit of the room settings. */
export interface UpdateSettingsPayload {
  settings: RoomSettings;
}

export interface SessionAck {
  roomCode: string;
  playerId: string;
  token: string;
  state: FullState;
}

export interface GuessAck {
  colors: TileColor[];
  gains: LetterGain[];
  secondsGained: number;
  secondsLeft: number;
  at: number;
  attempt: number;
  solved: boolean;
  finished: boolean;
  solvedPosition: number | null;
}

export interface HintAck extends HintReveal {
  secondsLeft: number;
  at: number;
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (r: Ack<SessionAck>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (r: Ack<SessionAck>) => void) => void;
  'room:rejoin': (payload: RejoinPayload, ack: (r: Ack<SessionAck>) => void) => void;
  'room:leave': (ack?: (r: EmptyAck) => void) => void;
  'room:ready': (payload: { ready: boolean }, ack?: (r: EmptyAck) => void) => void;
  'room:start': (ack?: (r: EmptyAck) => void) => void;
  /** Host-only, finished-game only: reset the room to a fresh lobby and play again. */
  'room:restart': (ack?: (r: EmptyAck) => void) => void;
  'room:update-settings': (payload: UpdateSettingsPayload, ack?: (r: EmptyAck) => void) => void;
  'game:guess': (payload: GuessPayload, ack: (r: Ack<GuessAck>) => void) => void;
  'game:hint': (ack: (r: Ack<HintAck>) => void) => void;
  'reaction:send': (payload: ReactionPayload, ack?: (r: EmptyAck) => void) => void;
  /** Opening or closing her brain panel; streaming costs CPU, so it is asked for. */
  'boss:watch': (payload: { watching: boolean }, ack?: (r: EmptyAck) => void) => void;
}

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export interface PenaltyPayload {
  fromPlayerId: string;
  seconds: number;
  /** New clocks of every player that was penalised. */
  clocks: { playerId: string; secondsLeft: number; at: number }[];
}

export interface SolvedPayload {
  playerId: string;
  position: number;
  attempt: number;
  secondsLeft: number;
}

/** A player gave up their seat for good (`room:leave`), not a disconnection. */
export interface PlayerLeftPayload {
  playerId: string;
  name: string;
  /** Set when the leaver was the host and the room promoted somebody else. */
  newHostId: string | null;
}

/** The same player rejoined from another socket; this one is no longer bound. */
export interface SessionReplacedPayload {
  roomCode: string;
}

export interface ServerToClientEvents {
  'lobby:update': (lobby: LobbyState) => void;
  'round:start': (round: RoundState) => void;
  'player:progress': (progress: PlayerProgress) => void;
  'player:solved': (payload: SolvedPayload) => void;
  'player:hint': (payload: { playerId: string }) => void;
  'player:left': (payload: PlayerLeftPayload) => void;
  'time:penalty': (payload: PenaltyPayload) => void;
  /** The fly took a turn: what she chose and how sure she was. */
  'boss:decision': (payload: BossDecisionState & { playerId: string }) => void;
  /** Live brain activity, only while somebody in the room is watching. */
  'boss:frame': (payload: BossFrame) => void;
  'round:end': (payload: RoundEndPayload) => void;
  'game:end': (payload: GameEndPayload) => void;
  'reaction:show': (payload: { playerId: string; emote: Emote }) => void;
  'session:replaced': (payload: SessionReplacedPayload) => void;
  error: (payload: ErrorPayload) => void;
}
