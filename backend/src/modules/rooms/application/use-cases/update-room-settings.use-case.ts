import { Inject, Injectable } from '@nestjs/common';
import type { RoomSettings } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '../../domain/interfaces/room-repository.interface';
import { syncBossSeat } from '../../domain/services/boss-seat';

/**
 * The host re-writes the room settings from the lobby (docs/context/02-game-rules.md
 * -> Room). Only while nothing is running, and never below the number of
 * players already seated. Ready flags survive: the rules changed, not the room.
 */
@Injectable()
export class UpdateRoomSettingsUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
  ) {}

  execute(roomCode: string, playerId: string, settings: RoomSettings): void {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');
    if (!player.isHost) throw new DomainException('not_host');
    if (room.status !== 'lobby') throw new DomainException('game_in_progress');
    // Capacity counts humans; the fly does not occupy one of the seats.
    const seated = room.humanPlayers().length;
    if (settings.capacity < seated) {
      throw new DomainException(
        'invalid_payload',
        `Capacity cannot be lower than the ${seated} players already in the room`,
      );
    }

    const now = this.clock.now();
    room.updateSettings(settings);
    // Turning boss mode on seats the fly; turning it off frees her seat.
    syncBossSeat(room, now);
    room.touch(now);
    this.bus.publish({ roomCode: room.code, event: 'lobby:update', payload: room.toLobbyState() });
  }
}
