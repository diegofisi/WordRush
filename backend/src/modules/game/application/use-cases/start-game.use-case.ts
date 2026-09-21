import { Inject, Injectable } from '@nestjs/common';
import { ROOM_LIMITS } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { StartRoundUseCase } from './start-round.use-case';

/**
 * Host starts the game from the lobby. Readiness is informational only:
 * players who are not ready enter anyway.
 */
@Injectable()
export class StartGameUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly startRound: StartRoundUseCase,
  ) {}

  execute(roomCode: string, playerId: string): void {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');
    if (!player.isHost) throw new DomainException('not_host');
    if (room.status !== 'lobby') throw new DomainException('game_in_progress');
    const minimum = ROOM_LIMITS.minPlayers;
    if (room.connectedPlayers().length < minimum) {
      throw new DomainException('not_enough_players');
    }
    // Team mode: an empty team has nobody to play for, so both need somebody.
    if (room.teams.some((team) => !room.members(team.id).some((p) => p.connected))) {
      throw new DomainException('not_enough_players', 'Both teams need a connected player');
    }
    this.startRound.execute(room, this.clock.now());
  }
}
