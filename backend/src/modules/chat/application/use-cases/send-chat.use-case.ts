import { Inject, Injectable } from '@nestjs/common';
import { ROOM_LIMITS, type ChatChannel } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { canRead, canSend } from '../../domain/services/chat-visibility';
import { maskProfanity } from '../../domain/services/profanity-filter';

const CHAT_INTERVAL_MS = ROOM_LIMITS.chatIntervalSeconds * 1000;

/**
 * Stores one chat message and hands it to every socket allowed to read it
 * (docs/context/06-v1.1.md -> Chat). One message per second per person; the
 * offensive-word filter masks, it does not refuse.
 */
@Injectable()
export class SendChatUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
  ) {}

  execute(roomCode: string, playerId: string, channel: ChatChannel, text: string): void {
    const room = this.rooms.findByCode(roomCode);
    const sender = room?.findAnyone(playerId);
    if (!room || !sender) throw new DomainException('not_in_room');
    if (!canSend(room, sender, channel)) throw new DomainException('chat_not_allowed');

    const now = this.clock.now();
    if (now - sender.lastChatAt < CHAT_INTERVAL_MS) throw new DomainException('cooldown');
    sender.lastChatAt = now;

    const message = room.addChatMessage(sender, channel, maskProfanity(text), now);
    room.touch(now);
    for (const person of room.everyone) {
      if (!person.connected || !canRead(room, person, message)) continue;
      this.bus.publish({
        roomCode: room.code,
        toPlayerId: person.id,
        event: 'chat:message',
        payload: message,
      });
    }
  }
}
