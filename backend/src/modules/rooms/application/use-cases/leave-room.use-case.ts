import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '../../domain/interfaces/room-repository.interface';

/**
 * Removes a player for good. Host leaving promotes the oldest remaining
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
    if (!room) return;
    const removed = room.removePlayer(playerId);
    if (!removed) return;
    if (room.isEmpty()) {
      this.rooms.delete(room.code);
      this.logger.log(`Room ${room.code} deleted (empty)`);
      return;
    }
    room.touch(this.clock.now());
    this.bus.publish({ roomCode: room.code, event: 'lobby:update', payload: room.toLobbyState() });
  }
}
