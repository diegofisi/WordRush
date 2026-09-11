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

export const CONTRACT_VERSION = 3;

export type Language = 'es' | 'en';
export type TileColor = 'green' | 'yellow' | 'gray';
export type Emote = 'smile' | 'laugh' | 'angry' | 'cry' | 'shock' | 'thumbs';
export type RoomStatus = 'lobby' | 'playing' | 'between-rounds' | 'finished';

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 8;
export const EMOTES: readonly Emote[] = ['smile', 'laugh', 'angry', 'cry', 'shock', 'thumbs'];

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
  emoteCooldownSeconds: 3,
} as const;

/** docs/context/02-game-rules.md and 03-scoring-system.md */
export const SCORING = {
  yellowSeconds: 5,
  greenSeconds: 10,
  greenAfterYellowSeconds: 5,
  greenAfterHintSeconds: 5,
  penaltyOnRivalSolveSeconds: 5,
  attemptPenalty: 3,
  positionBonus: [25, 15, 10] as const,
  hintKeptBonus: 10,
  solveFloor: 20,
  pointsPerGreenUnsolved: 5,
  maxGreensUnsolved: 4,
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
}

export interface PlayerPublic {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
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

export interface RoundState extends RoundInfo {
  me: SelfState;
  players: PlayerProgress[];
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
  attemptPenalty: number;
  positionBonus: number;
  hintBonus: number;
  greens: number;
  greenPoints: number;
  floorApplied: boolean;
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
  'game:guess': (payload: GuessPayload, ack: (r: Ack<GuessAck>) => void) => void;
  'game:hint': (ack: (r: Ack<HintAck>) => void) => void;
  'reaction:send': (payload: ReactionPayload, ack?: (r: EmptyAck) => void) => void;
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
  'round:end': (payload: RoundEndPayload) => void;
  'game:end': (payload: GameEndPayload) => void;
  'reaction:show': (payload: { playerId: string; emote: Emote }) => void;
  'session:replaced': (payload: SessionReplacedPayload) => void;
  error: (payload: ErrorPayload) => void;
}
