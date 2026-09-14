import { Inject, Injectable, Logger } from '@nestjs/common';
import { BOSS, ROOM_LIMITS, type RoundEndPayload } from '@shared/contract';
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
    const { initialSeconds, hintEnabled, rounds, bossMode } = room.settings;

    // The team wins the round when the fly did not solve it, whether she ran
    // out of clock or out of attempts (docs/context/06-boss-mode.md).
    const bot = room.bot;
    const bossDefeated = bossMode && bot ? bot.round?.solved !== true : null;
    const teamBonus = bossDefeated === true ? BOSS.defeatedBonus : 0;

    // She plays on the room's clock now, so the points formula measures her
    // against the same number as everyone and she belongs in the table like any
    // other player (docs/context/06-boss-mode.md).
    const scored = room.players;

    const breakdown = scored.map((player) => {
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
          yellows: round?.yellows ?? 0,
        },
        initialSeconds,
        hintEnabled,
        teamBonus,
      );
      player.totalPoints += result.roundPoints;
      player.totalAttempts += result.attempt;
      if (round?.hintUsed) player.hintsUsed += 1;
      return result;
    });

    const standings = computeStandings(
      scored.map((p) => ({
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
      bossDefeated,
      boss:
        bossMode && bot?.round
          ? {
              solved: bot.round.solved,
              attempts: bot.round.attempt,
              defeated: !bot.round.solved,
              secondsLeft: bot.round.secondsLeft(now),
              rows: bot.round.rows.map((row) => ({ word: row.word, colors: [...row.colors] })),
            }
          : null,
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
