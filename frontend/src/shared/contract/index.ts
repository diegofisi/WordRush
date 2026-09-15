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

export const CONTRACT_VERSION = 12;

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

/** Room setting since v1.1: five, six or seven letters (docs/context/06-v1.1.md). */
export type WordLength = 5 | 6 | 7;
export const WORD_LENGTHS: readonly WordLength[] = [5, 6, 7];
export const DEFAULT_WORD_LENGTH: WordLength = 5;
/** Attempts per round grow with the word: 8 / 9 / 10. */
export const ATTEMPTS_BY_LENGTH: Record<WordLength, number> = { 5: 8, 6: 9, 7: 10 };
export const attemptsFor = (length: WordLength): number => ATTEMPTS_BY_LENGTH[length];

/**
 * Teams (docs/context/06-v1.1.md -> Teams). Two teams, any split; one clock,
 * one hint and one score per team; members keep their own boards.
 */
export type GameMode = 'normal' | 'teams';
export type TeamId = 'a' | 'b';
export const TEAM_IDS: readonly TeamId[] = ['a', 'b'];
export type TeamColor = 'violet' | 'gold' | 'green' | 'red' | 'blue' | 'pink';
export const TEAM_COLORS: readonly TeamColor[] = ['violet', 'gold', 'green', 'red', 'blue', 'pink'];
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

/** docs/context/02-game-rules.md and 03-scoring-system.md */
export const SCORING = {
  yellowSeconds: 5,
  greenSeconds: 10,
  greenAfterYellowSeconds: 5,
  greenAfterHintSeconds: 5,
  penaltyOnRivalSolveSeconds: 5,
  /** v1.1: −4 per attempt after the first (was −2); the solve floor of 40 stays. */
  attemptPenalty: 4,
  positionBonus: [20, 15, 10] as const,
  /** Team mode: only the first team to solve gets a position bonus. */
  teamFirstBonus: 20,
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
  /** Normal (everyone for themselves) or two teams. */
  mode: GameMode;
  wordLength: WordLength;
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
  /** Null in the normal mode. */
  team: TeamId | null;
}

export interface TeamPublic {
  id: TeamId;
  /** Empty until the members name it; the client shows a default then. */
  name: string;
  color: TeamColor;
  /** Rounds won in the current game. */
  roundsWon: number;
  /** Games won in this room; survives "play again" until the host resets it. */
  gamesWon: number;
}

export interface LobbyState {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: PlayerPublic[];
  /** Both teams in team mode; empty otherwise. */
  teams: TeamPublic[];
}

/**
 * What everyone sees about a player during a round: colours only, never
 * letters. In team mode the clock and `finished` are the team's.
 */
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

/**
 * What the hint revealed (docs/context/06-v1.1.md -> Hint). While some answer
 * position is still unknown it is a new **letter** of the word, position
 * unsaid; once every letter is known it **places** one of the yellows.
 */
export type HintKind = 'letter' | 'position';
export interface HintReveal {
  letter: string;
  kind: HintKind;
  /** 0-based answer position; only for `kind: 'position'`. */
  position: number | null;
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

/** A team during the round: its shared clock, hint and solve. */
export interface TeamRoundState {
  id: TeamId;
  secondsLeft: number;
  at: number;
  solved: boolean;
  solvedPosition: number | null;
  solverId: string | null;
  finished: boolean;
  hintUsed: boolean;
  penaltySeconds: number;
  /** Words sent by every member after each one's first: the penalty base. */
  attemptsAfterFirst: number;
}

/** A teammate's board, letters included: teammates see each other live. */
export interface TeammateRows {
  playerId: string;
  rows: OwnRow[];
}

export interface RoundInfo {
  round: number;
  totalRounds: number;
  mode: GameMode;
  /** Letters per word and attempts this round, from the room settings. */
  wordLength: WordLength;
  maxAttempts: number;
  initialSeconds: number;
  startedAt: number;
  hintAvailable: boolean;
}

export interface RoundState extends RoundInfo {
  me: SelfState;
  players: PlayerProgress[];
  /** Team mode only; empty otherwise. */
  teams: TeamRoundState[];
  myTeam: TeamId | null;
  /** My teammates' boards with letters; empty in the normal mode. */
  teammates: TeammateRows[];
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

/** docs/context/06-v1.1.md -> Team scoring, one team. */
export interface TeamRoundBreakdown {
  team: TeamId;
  name: string;
  color: TeamColor;
  solved: boolean;
  solverId: string | null;
  solverName: string | null;
  position: number | null;
  timeLeftPercent: number | null;
  timePoints: number;
  solveBonus: number;
  /** Every member's attempts after their first, −4 each. */
  attemptsAfterFirst: number;
  attemptPenalty: number;
  positionBonus: number;
  hintBonus: number;
  roundPoints: number;
}

export interface TeamStanding {
  team: TeamId;
  name: string;
  color: TeamColor;
  total: number;
  roundsWon: number;
  gamesWon: number;
  rank: number;
}

export interface RoundEndPayload {
  round: number;
  totalRounds: number;
  mode: GameMode;
  word: string;
  /** Per player in the normal mode; empty in team mode (points are the team's). */
  breakdown: RoundBreakdown[];
  standings: Standing[];
  /** Team mode only; empty otherwise. */
  teams: TeamRoundBreakdown[];
  teamStandings: TeamStanding[];
  /** Seconds until the next round starts automatically; 0 when the game ended. */
  nextRoundIn: number;
}

export interface GameEndPayload {
  standings: Standing[];
  teamStandings: TeamStanding[];
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
  /** The server is at its room cap; unrelated to a single room being full. */
  | 'server_full'
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
  /** Team actions outside team mode, or on a team the player is not in. */
  | 'not_in_team'
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

/** Any player moves themselves; the host moves anybody. Lobby only. */
export interface JoinTeamPayload {
  team: TeamId;
}
export interface AssignTeamPayload {
  playerId: string;
  team: TeamId;
}
/** Members rename or recolour their own team. Lobby only. */
export interface CustomizeTeamPayload {
  team: TeamId;
  name?: string;
  color?: TeamColor;
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
  'team:join': (payload: JoinTeamPayload, ack?: (r: EmptyAck) => void) => void;
  'team:assign': (payload: AssignTeamPayload, ack?: (r: EmptyAck) => void) => void;
  'team:customize': (payload: CustomizeTeamPayload, ack?: (r: EmptyAck) => void) => void;
  /** Host-only: the games-won counters back to zero. */
  'team:reset-games': (ack?: (r: EmptyAck) => void) => void;
  'game:guess': (payload: GuessPayload, ack: (r: Ack<GuessAck>) => void) => void;
  'game:hint': (ack: (r: Ack<HintAck>) => void) => void;
  'reaction:send': (payload: ReactionPayload, ack?: (r: EmptyAck) => void) => void;
}

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

/** Hints are anonymous: the room learns that one was spent, never by whom. */
export interface HintUsedPayload {
  /** Hints spent in the round so far, this one included. */
  usedInRound: number;
}

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
  'player:hint': (payload: HintUsedPayload) => void;
  /** Team mode: a teammate's board with letters, to their teammates only. */
  'teammate:progress': (payload: TeammateRows) => void;
  /** Team mode: the team's hint, to every member (the spender included). */
  'team:hint': (payload: HintReveal) => void;
  /** Team mode: the shared clocks after anything moved them. */
  'team:clocks': (payload: TeamRoundState[]) => void;
  'player:left': (payload: PlayerLeftPayload) => void;
  'time:penalty': (payload: PenaltyPayload) => void;
  'round:end': (payload: RoundEndPayload) => void;
  'game:end': (payload: GameEndPayload) => void;
  'reaction:show': (payload: { playerId: string; emote: Emote }) => void;
  'session:replaced': (payload: SessionReplacedPayload) => void;
  error: (payload: ErrorPayload) => void;
}
