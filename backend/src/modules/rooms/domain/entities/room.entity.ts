import {
  ROOM_LIMITS,
  TEAM_IDS,
  type ChatChannel,
  type ChatMessage,
  type LobbyState,
  type RoomSettings,
  type RoomStatus,
  type RoundEndPayload,
  type TeamId,
} from '@shared/contract';
import type { ParsedPhrase } from '@modules/game/domain/services/phrase';
import type { Player } from './player.entity';
import { Team } from './team.entity';

/**
 * Aggregate root: a room with its players, settings and the state of the
 * current game. All mutation happens through use cases in a single process,
 * so no locking is needed; solving is processed synchronously per room.
 */
export class Room {
  status: RoomStatus = 'lobby';
  readonly players: Player[] = [];
  lastActivityAt: number;
  currentRound = 0;
  /** The answer of the current round. Never emitted before `round:end`. */
  word: string | null = null;
  readonly usedWords: string[] = [];
  /** Phrase game: the phrase of the current round; null in Wordle. */
  phrase: ParsedPhrase | null = null;
  readonly usedPhrases: string[] = [];
  roundStartedAt = 0;
  solvedCount = 0;
  lastRoundEnd: RoundEndPayload | null = null;
  finishedAt: number | null = null;
  nextRoundAt: number | null = null;
  /** Both teams in team mode; empty in the normal mode. */
  readonly teams: Team[] = [];
  /** Joined a running game; they watch and talk (docs/context/06-v1.1.md -> Observers). */
  readonly observers: Player[] = [];
  /** The whole game's chat, oldest first; a new game starts it afresh. */
  readonly chat: ChatMessage[] = [];
  private nextChatId = 1;
  /** Kicked names (lower-cased) -> epoch ms until which they may not come back. */
  private readonly blockedNames = new Map<string, number>();

  private constructor(
    readonly code: string,
    readonly settings: RoomSettings,
    readonly createdAt: number,
  ) {
    this.lastActivityAt = createdAt;
  }

  static create(code: string, settings: RoomSettings, now: number): Room {
    const room = new Room(code, settings, now);
    if (settings.mode === 'teams') room.formTeams();
    return room;
  }

  // ------------------------------------------------------------- teams

  /** Creates the two teams and seats everybody; a no-op when they exist. */
  formTeams(): void {
    if (this.teams.length > 0) return;
    for (const id of TEAM_IDS) this.teams.push(new Team(id));
    for (const player of this.players) if (!player.team) this.autoAssign(player);
  }

  /** Back to the normal mode: no teams, no seats in them. */
  dissolveTeams(): void {
    this.teams.length = 0;
    for (const player of this.players) player.team = null;
  }

  team(id: TeamId): Team {
    const team = this.teams.find((t) => t.id === id);
    if (!team) throw new Error(`Room ${this.code} has no team ${id}`);
    return team;
  }

  teamOf(player: Player): Team | null {
    return player.team ? (this.teams.find((t) => t.id === player.team) ?? null) : null;
  }

  members(id: TeamId): Player[] {
    return this.players.filter((p) => p.team === id);
  }

  /** The smaller team, the first on a tie: any split is legal, this is only a default. */
  autoAssign(player: Player): void {
    if (this.teams.length === 0) return;
    const [a, b] = TEAM_IDS;
    player.team = this.members(b).length < this.members(a).length ? b : a;
  }

  get host(): Player | undefined {
    return this.players.find((p) => p.isHost);
  }

  /** A seated player; observers are found with `findAnyone`. */
  findPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  findObserver(id: string): Player | undefined {
    return this.observers.find((p) => p.id === id);
  }

  /** Seated or observing: whoever holds a session in this room. */
  findAnyone(id: string): Player | undefined {
    return this.findPlayer(id) ?? this.findObserver(id);
  }

  /** Everybody in the room, seated first. */
  get everyone(): Player[] {
    return [...this.players, ...this.observers];
  }

  hasName(name: string): boolean {
    const wanted = name.toLowerCase();
    return this.everyone.some((p) => p.name.toLowerCase() === wanted);
  }

  /** Connected players: the minimum to start, and whether a room is abandoned. */
  connectedPlayers(): Player[] {
    return this.players.filter((p) => p.connected);
  }

  isFull(): boolean {
    return this.players.length >= this.settings.capacity;
  }

  hasObserverRoom(): boolean {
    return this.observers.length < ROOM_LIMITS.maxObservers;
  }

  /** No seated player left: observers alone cannot keep a room alive. */
  isEmpty(): boolean {
    return this.players.length === 0;
  }

  addPlayer(player: Player): void {
    // Whoever takes the first seat of a host-less room hosts it.
    if (!this.host) player.isHost = true;
    this.players.push(player);
    if (this.settings.mode === 'teams') this.autoAssign(player);
  }

  addObserver(observer: Player): void {
    this.observers.push(observer);
  }

  removeObserver(id: string): Player | undefined {
    const index = this.observers.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    return this.observers.splice(index, 1)[0];
  }

  /** Moves an observer into a free seat; false when there is none. */
  seat(observer: Player): boolean {
    if (this.isFull()) return false;
    const removed = this.removeObserver(observer.id);
    if (!removed) return false;
    removed.takeSeat();
    this.addPlayer(removed);
    return true;
  }

  /**
   * Seats the observers who asked for it, oldest first, while seats last;
   * nobody is moved who did not ask. Returns whoever got a seat.
   */
  seatWaitingObservers(): Player[] {
    const seated: Player[] = [];
    const waiting = this.observers
      .filter((p) => p.wantsSeat && p.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    for (const observer of waiting) {
      if (!this.seat(observer)) break;
      seated.push(observer);
    }
    return seated;
  }

  // -------------------------------------------------------------- kicks

  blockName(name: string, until: number): void {
    this.blockedNames.set(name.trim().toLowerCase(), until);
  }

  /**
   * Seconds this name still has to wait before it may come back, 0 when it may
   * join now. Rounded up, so the last fraction of a second is still a "1" and
   * never a "0 seconds" that refuses anyway; the expired entry is dropped on
   * the way out.
   */
  nameBlockSecondsLeft(name: string, now: number): number {
    const key = name.trim().toLowerCase();
    const until = this.blockedNames.get(key);
    if (until === undefined) return 0;
    if (now >= until) {
      this.blockedNames.delete(key);
      return 0;
    }
    return Math.ceil((until - now) / 1000);
  }

  isNameBlocked(name: string, now: number): boolean {
    return this.nameBlockSecondsLeft(name, now) > 0;
  }

  // -------------------------------------------------------------- chat

  /** Appends a message to the game's chat and returns it. */
  addChatMessage(sender: Player, channel: ChatChannel, text: string, now: number): ChatMessage {
    const message: ChatMessage = {
      id: this.nextChatId++,
      round: this.currentRound,
      playerId: sender.id,
      name: sender.name,
      observer: sender.isObserver,
      team: sender.team,
      channel,
      text,
      at: now,
      duringPlay: this.status === 'playing',
    };
    this.chat.push(message);
    return message;
  }

  /**
   * Removes a player; if they were host, the oldest remaining **connected**
   * player takes over (the oldest of all, when nobody is connected).
   */
  removePlayer(id: string): Player | undefined {
    const index = this.players.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    const [removed] = this.players.splice(index, 1);
    if (removed.isHost) {
      const byAge = [...this.players].sort((a, b) => a.joinedAt - b.joinedAt);
      const heir = byAge.find((p) => p.connected) ?? byAge[0];
      if (heir) heir.isHost = true;
    }
    return removed;
  }

  touch(now: number): void {
    this.lastActivityAt = now;
  }

  /**
   * "Play again": the finished game is wiped and the room becomes the very
   * lobby it started as (docs/context/02-game-rules.md -> "Playing again").
   * Code, settings, host and the player list survive — disconnected players
   * included, so they can still come back. Everything the game wrote (round
   * counter, word, used words, standings, per-round state) and the janitor's
   * `finishedAt` marker are cleared, so the room is judged by lobby rules
   * again and is never deleted as "a finished game".
   */
  resetForNewGame(now: number): void {
    this.status = 'lobby';
    this.currentRound = 0;
    this.word = null;
    this.usedWords.length = 0;
    this.phrase = null;
    this.usedPhrases.length = 0;
    this.roundStartedAt = 0;
    this.solvedCount = 0;
    this.lastRoundEnd = null;
    this.finishedAt = null;
    this.nextRoundAt = null;
    for (const player of this.players) player.resetForNewGame(now);
    for (const team of this.teams) team.resetForNewGame();
    // A new game starts a new chat; observers who asked for a seat take one now.
    this.chat.length = 0;
    this.seatWaitingObservers();
    this.touch(now);
  }

  /**
   * Replaces the settings in place (the reference is shared with whatever the
   * round already read). Only legal in the lobby: the use case checks the
   * status and that the new capacity still fits everybody in the room.
   */
  updateSettings(next: RoomSettings): void {
    Object.assign(this.settings, next);
    if (next.mode === 'teams') this.formTeams();
    else this.dissolveTeams();
  }

  /**
   * Epoch ms since which nobody has been connected; null while someone is.
   * A room with nobody in it at all is deleted on the spot by the use case
   * that emptied it, so the last-activity fallback is only a safety net.
   */
  lastDisconnectionAt(): number | null {
    const everyone = this.everyone;
    if (everyone.some((p) => p.connected)) return null;
    if (everyone.length === 0) return this.lastActivityAt;
    return Math.max(...everyone.map((p) => p.disconnectedAt ?? this.createdAt));
  }

  toLobbyState(): LobbyState {
    return {
      code: this.code,
      status: this.status,
      settings: { ...this.settings },
      players: this.players.map((p) => p.toPublic()),
      teams: this.teams.map((t) => t.toPublic()),
      observers: this.observers.map((p) => p.toObserverPublic()),
    };
  }
}
