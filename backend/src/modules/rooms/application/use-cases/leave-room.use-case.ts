import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '../../domain/interfaces/room-repository.interface';
import { toPlayerProgress } from '../../domain/services/state-presenter';

/**
 * Removes a player for good (`room:leave`), from the lobby, mid-round or on
 * the results screen. Unlike a disconnection this frees the seat: the stored
 * token stops working (`session_expired` on rejoin).
 *
 * Mid-round the player's round is closed first, so the room is no longer
 * waiting for them; the ticker closes the round on its next pass when nobody
 * else is still playing. Host leaving promotes the oldest remaining connected
 * player; an empty room is deleted. Idempotent: leaving twice is a no-op.
 */
@Injectable()
export class LeaveRoomUseCase {
  private readonly logger = new Logger(LeaveRoomUseCase.name);

  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
  ) {}

  execute(roomCode: string, playerId: string): void {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) return;

    const now = this.clock.now();
    const wasHost = player.isHost;
    // Freeze their clock so `isRoundOver` no longer waits for them.
    player.round?.finish('left', now);
    const lastProgress = toPlayerProgress(player, now);

    const removed = room.removePlayer(playerId);
    if (!removed) return;

    if (room.isEmpty()) {
      this.rooms.delete(room.code);
      this.logger.log(`Room ${room.code} deleted (empty)`);
      return;
    }

    room.touch(now);
    // Who is gone first, then their final board: the other way round the
    // closed round would read as "ran out of time" on everybody's feed.
    this.bus.publish({
      roomCode: room.code,
      event: 'player:left',
      payload: {
        playerId: removed.id,
        name: removed.name,
        newHostId: wasHost ? (room.host?.id ?? null) : null,
      },
    });
    this.bus.publish({ roomCode: room.code, event: 'player:progress', payload: lastProgress });
    this.bus.publish({ roomCode: room.code, event: 'lobby:update', payload: room.toLobbyState() });
  }
}
