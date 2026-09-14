import type { PlayerPublic } from '@shared/contract';
import type { PlayerRound } from './player-round.entity';

export interface PlayerProps {
  id: string;
  token: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  /** The fly's seat: no socket, no capacity slot, never host. */
  isBot?: boolean;
}

export class Player {
  readonly id: string;
  /** Secret handed to the owning client; proves identity on rejoin. */
  readonly token: string;
  readonly name: string;
  readonly joinedAt: number;
  /** True only for the fly. docs/context/06-boss-mode.md */
  readonly isBot: boolean;
  isHost: boolean;
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

  private constructor(props: PlayerProps) {
    this.id = props.id;
    this.token = props.token;
    this.name = props.name;
    this.isHost = props.isHost;
    this.joinedAt = props.joinedAt;
    this.isBot = props.isBot === true;
  }

  static create(props: PlayerProps): Player {
    return new Player(props);
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
   * no totals, no round. Somebody who is away keeps their seat but their
   * lobby grace period starts again with the new lobby, so a restart does not
   * hand the janitor a stale `disconnectedAt` to prune them with.
   */
  resetForNewGame(now: number): void {
    this.ready = false;
    this.totalPoints = 0;
    this.totalAttempts = 0;
    this.hintsUsed = 0;
    this.round = null;
    if (!this.connected) this.disconnectedAt = now;
  }

  toPublic(): PlayerPublic {
    return {
      id: this.id,
      name: this.name,
      isHost: this.isHost,
      ready: this.ready,
      connected: this.connected,
      isBot: this.isBot,
    };
  }
}
