import { Inject, Injectable, Logger } from '@nestjs/common';
import { ROOM_LIMITS, type RoundEndPayload } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { computeStandings, scoreRound } from '../../domain/services/scoring';
import { RoundSchedulerService } from '../services/round-scheduler.service';
import { StartRoundUseCase } from './start-round.use-case';

/**
 * Scores the round, updates the accumulated table, reveals the word and either
 * schedules the next round or ends the game. A round that ends with nobody
 * connected ends the game too: no round is ever started into an empty room.
 */
@Injectable()
export class EndRoundUseCase {
  private readonly logger = new Logger(EndRoundUseCase.name);

  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly bus: RoomEventsBus,
    private readonly scheduler: RoundSchedulerService,
    private readonly startRound: StartRoundUseCase,
  ) {}

  execute(room: Room, now: number): RoundEndPayload {
    const { initialSeconds, hintEnabled, rounds } = room.settings;

    const breakdown = room.players.map((player) => {
      const round = player.round;
      const result = scoreRound(
        {
          playerId: player.id,
          name: player.name,
          solved: round?.solved ?? false,
          attempt: round?.attempt ?? 0,
          position: round?.solvedPosition ?? null,
          secondsLeftAtSolve: round?.frozenSecondsLeft ?? 0,
          hintUsed: round?.hintUsed ?? false,
          greens: round?.greens ?? 0,
        },
        initialSeconds,
        hintEnabled,
      );
      player.totalPoints += result.roundPoints;
      player.totalAttempts += result.attempt;
      if (round?.hintUsed) player.hintsUsed += 1;
      return result;
    });

    const standings = computeStandings(
      room.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        total: p.totalPoints,
        attempts: p.totalAttempts,
        hintsUsed: p.hintsUsed,
      })),
    );

    // Nobody left to play for: the game ends here instead of starting a round
    // into an empty room (docs/context/02-game-rules.md).
    const abandoned = room.connectedPlayers().length === 0;
    const isLast = room.currentRound >= rounds || abandoned;
    const payload: RoundEndPayload = {
      round: room.currentRound,
      totalRounds: rounds,
      word: room.word ?? '',
      breakdown,
      standings,
      nextRoundIn: isLast ? 0 : ROOM_LIMITS.betweenRoundsSeconds,
    };

    room.lastRoundEnd = payload;
    room.touch(now);
    this.bus.publish({ roomCode: room.code, event: 'round:end', payload });

    if (isLast) {
      room.status = 'finished';
      room.finishedAt = now;
      this.bus.publish({
        roomCode: room.code,
        event: 'game:end',
        payload: { standings, rounds },
      });
      this.logger.log(
        abandoned && room.currentRound < rounds
          ? `Room ${room.code}: game finished early, nobody connected`
          : `Room ${room.code}: game finished after ${rounds} round(s)`,
      );
    } else {
      room.status = 'between-rounds';
      const delayMs = ROOM_LIMITS.betweenRoundsSeconds * 1000;
      room.nextRoundAt = now + delayMs;
      this.scheduler.schedule(room.code, delayMs, () => this.startNextRound(room.code));
    }
    return payload;
  }

  private startNextRound(roomCode: string): void {
    const room = this.rooms.findByCode(roomCode);
    // The room may have been deleted (everyone left) while waiting.
    if (!room || room.status !== 'between-rounds') return;
    this.startRound.execute(room, this.clock.now());
  }
}
