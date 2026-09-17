import { Inject, Injectable } from '@nestjs/common';
import type { RoomSettings } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '../../domain/interfaces/room-repository.interface';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
import { syncBossSeat } from '@modules/boss/domain/services/boss-seat';

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
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md): `humanPlayers()` was `players` — the fly costs no seat.
    const seated = room.humanPlayers().length;
    if (settings.capacity < seated) {
      throw new DomainException(
        'invalid_payload',
        `Capacity cannot be lower than the ${seated} players already in the room`,
      );
    }

    const now = this.clock.now();
    room.updateSettings(settings);
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
    // A rule change can make her unplayable (teams, the phrase game, 6 or 7
    // letters): that frees her seat, and turning it back on seats her again.
    syncBossSeat(room, now);
    room.touch(now);
    this.bus.publish({ roomCode: room.code, event: 'lobby:update', payload: room.toLobbyState() });
  }
}
