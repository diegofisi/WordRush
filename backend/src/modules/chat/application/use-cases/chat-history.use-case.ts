import { Inject, Injectable } from '@nestjs/common';
import type { ChatHistoryAck } from '@shared/contract';
import { DomainException } from '@shared/domain/domain.exception';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { canRead } from '../../domain/services/chat-visibility';

/**
 * The game's chat as the caller may read it right now: what a player who
 * just finished the round (or a reconnecting socket) is missing.
 */
@Injectable()
export class ChatHistoryUseCase {
  constructor(@Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository) {}

  execute(roomCode: string, playerId: string): ChatHistoryAck {
    const room = this.rooms.findByCode(roomCode);
    const reader = room?.findAnyone(playerId);
    if (!room || !reader) throw new DomainException('not_in_room');
    return { messages: room.chat.filter((message) => canRead(room, reader, message)) };
  }
}
