import { Inject, Injectable } from '@nestjs/common';
import type { TeamColor, TeamId } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import type { Player } from '../../domain/entities/player.entity';
import type { Room } from '../../domain/entities/room.entity';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '../../domain/interfaces/room-repository.interface';

/**
 * The four lobby actions of team mode (docs/context/06-v1.1.md -> Teams):
 * a player moves themselves, the host moves anybody, a team's members name
 * and colour it, and the host zeroes the games-won counters. All of them end
 * in a `lobby:update`, which is where the slots redraw from.
 */
abstract class TeamAction {
  constructor(
    @Inject(ROOM_REPOSITORY) protected readonly rooms: IRoomRepository,
    @Inject(CLOCK) protected readonly clock: Clock,
    protected readonly bus: RoomEventsBus,
  ) {}

  protected seated(roomCode: string, playerId: string): { room: Room; player: Player } {
    const room = this.rooms.findByCode(roomCode);
    const player = room?.findPlayer(playerId);
    if (!room || !player) throw new DomainException('not_in_room');
    if (room.settings.mode !== 'teams') throw new DomainException('not_in_team');
    return { room, player };
  }

  protected publish(room: Room): void {
    room.touch(this.clock.now());
    this.bus.publish({ roomCode: room.code, event: 'lobby:update', payload: room.toLobbyState() });
  }
}

@Injectable()
export class JoinTeamUseCase extends TeamAction {
  execute(roomCode: string, playerId: string, team: TeamId): void {
    const { room, player } = this.seated(roomCode, playerId);
    if (room.status !== 'lobby') throw new DomainException('game_in_progress');
    player.team = team;
    this.publish(room);
  }
}

@Injectable()
export class AssignTeamUseCase extends TeamAction {
  execute(roomCode: string, hostId: string, playerId: string, team: TeamId): void {
    const { room, player: host } = this.seated(roomCode, hostId);
    if (!host.isHost) throw new DomainException('not_host');
    if (room.status !== 'lobby') throw new DomainException('game_in_progress');
    const target = room.findPlayer(playerId);
    if (!target) throw new DomainException('invalid_payload', 'No such player in the room');
    target.team = team;
    this.publish(room);
  }
}

@Injectable()
export class CustomizeTeamUseCase extends TeamAction {
  execute(
    roomCode: string,
    playerId: string,
    teamId: TeamId,
    patch: { name?: string; color?: TeamColor },
  ): void {
    const { room, player } = this.seated(roomCode, playerId);
    if (room.status !== 'lobby') throw new DomainException('game_in_progress');
    // Only a team's own members (or the host) speak for it.
    if (player.team !== teamId && !player.isHost) throw new DomainException('not_in_team');
    const team = room.team(teamId);
    if (patch.name !== undefined) team.name = patch.name.trim();
    if (patch.color !== undefined) team.color = patch.color;
    this.publish(room);
  }
}

@Injectable()
export class ResetTeamGamesUseCase extends TeamAction {
  execute(roomCode: string, playerId: string): void {
    const { room, player } = this.seated(roomCode, playerId);
    if (!player.isHost) throw new DomainException('not_host');
    for (const team of room.teams) team.gamesWon = 0;
    this.publish(room);
  }
}
