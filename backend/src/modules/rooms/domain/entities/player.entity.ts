import type { PlayerPublic } from '@shared/contract';
import type { PlayerRound } from './player-round.entity';

export interface PlayerProps {
  id: string;
  token: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export class Player {
  readonly id: string;
  /** Secret handed to the owning client; proves identity on rejoin. */
  readonly token: string;
  readonly name: string;
  readonly joinedAt: number;
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
  lastReactionAt: number | null = null;

  private constructor(props: PlayerProps) {
    this.id = props.id;
    this.token = props.token;
    this.name = props.name;
    this.isHost = props.isHost;
    this.joinedAt = props.joinedAt;
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

  toPublic(): PlayerPublic {
    return {
      id: this.id,
      name: this.name,
      isHost: this.isHost,
      ready: this.ready,
      connected: this.connected,
    };
  }
}
