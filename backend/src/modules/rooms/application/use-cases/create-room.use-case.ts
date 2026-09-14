import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { Player } from '../../domain/entities/player.entity';
import { Room } from '../../domain/entities/room.entity';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '../../domain/interfaces/room-repository.interface';
import { syncBossSeat } from '../../domain/services/boss-seat';
import { generateRoomCode } from '../../domain/services/room-code.generator';
import { CreateRoomDto } from '../dtos/create-room.dto';

export interface RoomSession {
  room: Room;
  player: Player;
}

export function newPlayerToken(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class CreateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(dto: CreateRoomDto): RoomSession {
    const now = this.clock.now();
    const code = generateRoomCode((c) => this.rooms.exists(c));
    const room = Room.create(code, { ...dto.settings }, now);
    const player = Player.create({
      id: randomUUID(),
      token: newPlayerToken(),
      name: dto.name,
      isHost: true,
      joinedAt: now,
    });
    room.addPlayer(player);
    syncBossSeat(room, now);
    this.rooms.save(room);
    return { room, player };
  }
}
