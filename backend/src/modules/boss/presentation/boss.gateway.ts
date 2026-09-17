import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { BossWatchersService } from '../application/services/boss-watchers.service';

/**
 * Boss mode's own socket surface, so the game gateway never learns that the
 * fly exists: deleting boss mode is deleting this folder, not editing a file
 * with two hundred lines of the real game in it.
 *
 * Nest attaches every `@WebSocketGateway()` on the same port and namespace to
 * one shared Socket.IO server, so this class only adds handlers. It reads the
 * seat the game gateway already put on `client.data` and never writes it.
 */
interface SeatData {
  roomCode?: string;
  playerId?: string;
}

@WebSocketGateway()
export class BossGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(BossGateway.name);

  constructor(private readonly watchers: BossWatchersService) {}

  handleDisconnect(client: Socket<never, never, never, SeatData>): void {
    const playerId = client.data?.playerId;
    if (playerId) this.watchers.drop(playerId);
  }

  /** The fly's brain panel opened or closed; only watched rooms get live frames. */
  @SubscribeMessage('boss:watch')
  onBossWatch(
    @ConnectedSocket() client: Socket<never, never, never, SeatData>,
    @MessageBody() body: unknown,
  ): { ok: true } {
    const { roomCode, playerId } = client.data ?? {};
    // No seat, nothing to watch. Silent on purpose: this is a courtesy event,
    // never a move, so it must not be able to throw at a player.
    if (!roomCode || !playerId) return { ok: true };
    const watching =
      typeof body === 'object' &&
      body !== null &&
      (body as { watching?: unknown }).watching === true;
    this.watchers.set(roomCode, playerId, watching);
    this.logger.debug(`Room ${roomCode}: brain panel ${watching ? 'opened' : 'closed'}`);
    return { ok: true };
  }
}
