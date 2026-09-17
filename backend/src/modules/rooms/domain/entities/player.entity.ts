import type { ObserverPublic, PlayerPublic, Role, TeamId } from '@shared/contract';
import type { PlayerRound } from './player-round.entity';

export interface PlayerProps {
  id: string;
  token: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  /** Defaults to a seated player; observers join a running game. */
  role?: Role;
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  /** The fly's seat: no socket, no capacity slot, never host. */
  isBot?: boolean;
}

export class Player {
  readonly id: string;
  /** Secret handed to the owning client; proves identity on rejoin. */
  readonly token: string;
  readonly name: string;
  readonly joinedAt: number;
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
  /** True only for the fly. docs/context/08-boss-mode.md */
  readonly isBot: boolean;
  isHost: boolean;
  /** Seated player or observer (docs/context/06-v1.1.md -> Observers). */
  role: Role;
  /** Observer only: asked for a seat at the next round. */
  wantsSeat = false;
  /** Team mode: which of the two teams; null in the normal mode. */
  team: TeamId | null = null;
  ready = false;
  connected = true;
  disconnectedAt: number | null = null;
  /** Accumulated across rounds (the standings). */
  totalPoints = 0;
  totalAttempts = 0;
  hintsUsed = 0;
  /** Current (or last finished) round state; null in the lobby. */
  round: PlayerRound | null = null;
  /** Epoch ms of the emote sends inside the current burst window. */
  reactionTimes: number[] = [];
  /** Epoch ms until which emotes are refused after a burst; 0 when free. */
  reactionPausedUntil = 0;
  /** Epoch ms of the last chat message; one per second at most. */
  lastChatAt = 0;

  private constructor(props: PlayerProps) {
    this.id = props.id;
    this.token = props.token;
    this.name = props.name;
    this.isHost = props.isHost;
    this.joinedAt = props.joinedAt;
    this.role = props.role ?? 'player';
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
    this.isBot = props.isBot === true;
  }

  static create(props: PlayerProps): Player {
    return new Player(props);
  }

  get isObserver(): boolean {
    return this.role === 'observer';
  }

  markConnected(): void {
    this.connected = true;
    this.disconnectedAt = null;
  }

  markDisconnected(now: number): void {
    this.connected = false;
    this.disconnectedAt = now;
  }

  /**
   * Back to how the player entered the lobby the first time: no ready flag,
   * no totals, no round. Somebody who is away keeps their seat, and their
   * absence is counted from the new lobby, so a restart does not hand the
   * janitor a stale `disconnectedAt` to delete the room with.
   */
  resetForNewGame(now: number): void {
    this.ready = false;
    this.totalPoints = 0;
    this.totalAttempts = 0;
    this.hintsUsed = 0;
    this.round = null;
    if (!this.connected) this.disconnectedAt = now;
  }

  /** An observer takes a seat: a fresh player whose score starts now. */
  takeSeat(): void {
    this.role = 'player';
    this.wantsSeat = false;
    this.ready = false;
    this.totalPoints = 0;
    this.totalAttempts = 0;
    this.hintsUsed = 0;
    this.round = null;
  }

  toPublic(): PlayerPublic {
    return {
      id: this.id,
      name: this.name,
      isHost: this.isHost,
      ready: this.ready,
      connected: this.connected,
      team: this.team,
      // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
      isBot: this.isBot,
    };
  }

  toObserverPublic(): ObserverPublic {
    return {
      id: this.id,
      name: this.name,
      connected: this.connected,
      wantsSeat: this.wantsSeat,
    };
  }
}
