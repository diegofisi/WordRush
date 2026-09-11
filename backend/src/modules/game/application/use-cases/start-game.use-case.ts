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
 * players who are not ready enter anyway ("quien no esté listo entra igual").
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
    if (room.connectedPlayers().length < ROOM_LIMITS.minPlayers) {
      throw new DomainException('not_enough_players');
    }
    this.startRound.execute(room, this.clock.now());
  }
}
