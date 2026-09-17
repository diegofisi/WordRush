import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/domain/clock';
import type { Room } from '@modules/rooms/domain/entities/room.entity';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { RoundLifecycleService } from '../services/round-lifecycle.service';
import { EndRoundUseCase } from './end-round.use-case';

/**
 * Called right after somebody leaves the room or is kicked out of it, to settle
 * what their departure changed instead of waiting for the next tick:
 *
 * - the round closes straight away when nobody is left to play it;
 * - in team mode, a team everybody walked out of ends the game.
 */
@Injectable()
export class SettleRoundUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly lifecycle: RoundLifecycleService,
    private readonly endRound: EndRoundUseCase,
  ) {}

  execute(roomCode: string): void {
    const room = this.rooms.findByCode(roomCode);
    if (!room) return;
    const now = this.clock.now();
    if (this.endGameIfTeamWalkedOut(room, now)) return;
    if (room.status !== 'playing') return;
    this.lifecycle.closeSpentTeams(room, now);
    this.lifecycle.finishTimedOut(room, now);
    this.lifecycle.endRoundIfOver(room, now);
  }

  /**
   * Team mode: every member of one team has left the room on purpose
   * (docs/context/06-v1.1.md -> Teams). There is no game left — one team
   * cannot race nobody — so the current round is closed exactly as it stands
   * and the game ends with the standings so far. The room is marked finished,
   * so "play again" works from the results screen.
   *
   * A disconnection never gets here: it keeps the seat (the player stays in
   * the room, listed as away), and only leaving or being kicked empties a
   * team. In the normal mode nothing of this applies.
   */
  private endGameIfTeamWalkedOut(room: Room, now: number): boolean {
    if (room.teams.length === 0) return false;
    if (room.status !== 'playing' && room.status !== 'between-rounds') return false;
    if (room.teams.every((team) => room.members(team.id).length > 0)) return false;

    if (room.status === 'between-rounds') {
      // No round is open: the one that was about to start never happens.
      this.endRound.endGameNow(room, now);
      return true;
    }
    // Close every open round where it is: a team that solved keeps its
    // seconds and its points, one that did not scores the round it played.
    for (const player of room.players) player.round?.finish('left', now);
    for (const team of room.teams) team.round?.finish('left', now);
    this.endRound.execute(room, now, { final: true });
    return true;
  }
}
