import { Inject, Injectable } from '@nestjs/common';
import { ROOM_LIMITS, type Emote } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';

export const EMOTE_COOLDOWN_MS = ROOM_LIMITS.emoteCooldownSeconds * 1000;

/** Broadcasts an emote to the room with a per-player cooldown. */
@Injectable()
export class SendReactionUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
  ) {}

  execute(roomCode: string, playerId: string, emote: Emote): void {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');

    const now = this.clock.now();
    if (player.lastReactionAt !== null && now - player.lastReactionAt < EMOTE_COOLDOWN_MS) {
      throw new DomainException('cooldown');
    }
    player.lastReactionAt = now;
    room.touch(now);
    this.bus.publish({
      roomCode: room.code,
      event: 'reaction:show',
      payload: { playerId: player.id, emote },
    });
  }
}
