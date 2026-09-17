import { Inject, Injectable, Logger } from '@nestjs/common';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md): BOSS only.
import { BOSS, ROOM_LIMITS, type RoundEndPayload, type TeamStanding } from '@shared/contract';
import { CLOCK, type Clock } from '@shared/domain/clock';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { phrasePercent } from '../../domain/services/phrase';
import {
  computeStandings,
  computeTeamStandings,
  scorePhraseRound,
  scoreRound,
  scoreTeamPhraseRound,
  scoreTeamRound,
} from '../../domain/services/scoring';
import { RoundSchedulerService } from '../services/round-scheduler.service';
import { StartRoundUseCase } from './start-round.use-case';

/** Why a round is the last one, beyond having played them all. */
export interface EndRoundOptions {
  /**
   * End the game on this round whatever the counter says. Team mode uses it
   * when a whole team has walked out (docs/context/06-v1.1.md -> Teams).
   */
  final?: boolean;
}

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

  execute(room: Room, now: number, options: EndRoundOptions = {}): RoundEndPayload {
    const { initialSeconds, hintEnabled, rounds, mode, game } = room.settings;
    const teamMode = mode === 'teams';
    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
    // The team wins the round when the fly did not solve it, whether she ran
    // out of clock or out of attempts (docs/context/08-boss-mode.md). She is
    // scored by the same formula as everyone (she is on the room's clock) but
    // never collects the team's bonus and is never charged per attempt.
    const bot = room.settings.bossMode === true ? room.bot : undefined;
    const bossDefeated = bot ? bot.round?.solved !== true : null;
    const teamBonus = bossDefeated === true ? BOSS.defeatedBonus : 0;
    // BOSS-MODE — end.
    const phrase = room.phrase;
    const phraseGame = game === 'phrase' && phrase !== null;
    // Team mode: points are the team's; the per-player table stays empty.
    const breakdown = teamMode
      ? []
      : room.players.map((player) => {
          const round = player.round;
          if (phraseGame) {
            const progress = round?.phrase;
            const result = scorePhraseRound(
              {
                playerId: player.id,
                name: player.name,
                completed: progress?.completed ?? false,
                position: round?.solvedPosition ?? null,
                secondsLeftAtSolve: round?.frozenSecondsLeft ?? 0,
                wordsSent: progress?.wordsSent ?? 0,
                sendsFailed: progress?.sendsUsed ?? 0,
                percent: progress ? phrasePercent(phrase, progress.found) : 0,
              },
              initialSeconds,
            );
            player.totalPoints += result.roundPoints;
            player.totalAttempts += result.attempt;
            return result;
          }
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
            // BOSS-MODE (temporary; see docs/context/07-boss-removal.md)
            player.isBot ? 0 : teamBonus,
            !player.isBot,
          );
          player.totalPoints += result.roundPoints;
          player.totalAttempts += result.attempt;
          if (round?.hintUsed) player.hintsUsed += 1;
          return result;
        });

    const standings = teamMode
      ? []
      : computeStandings(
          room.players.map((p) => ({
            playerId: p.id,
            name: p.name,
            total: p.totalPoints,
            attempts: p.totalAttempts,
            hintsUsed: p.hintsUsed,
          })),
        );

    // Team mode (docs/context/06-v1.1.md -> Team scoring).
    const teams = room.teams.map((team) => {
      const round = team.round;
      const solver = round?.solverId ? room.findPlayer(round.solverId) : undefined;
      if (phraseGame) {
        const progress = round?.phrase;
        const result = scoreTeamPhraseRound(
          {
            team: team.id,
            name: team.name,
            color: team.color,
            completed: progress?.completed ?? false,
            solverId: round?.solverId ?? null,
            solverName: solver?.name ?? null,
            position: round?.solvedPosition ?? null,
            secondsLeftAtSolve: round?.frozenSecondsLeft ?? 0,
            wordsSent: progress?.wordsSent ?? 0,
            sendsFailed: progress?.sendsUsed ?? 0,
            percent: progress ? phrasePercent(phrase, progress.found) : 0,
          },
          initialSeconds,
        );
        team.totalPoints += result.roundPoints;
        return result;
      }
      const result = scoreTeamRound(
        {
          team: team.id,
          name: team.name,
          color: team.color,
          solved: round?.solved ?? false,
          solverId: round?.solverId ?? null,
          solverName: solver?.name ?? null,
          position: round?.solvedPosition ?? null,
          secondsLeftAtSolve: round?.frozenSecondsLeft ?? 0,
          hintUsed: round?.hintUsed ?? false,
          attemptsAfterFirst: round?.attemptsAfterFirst ?? 0,
        },
        initialSeconds,
        hintEnabled,
      );
      team.totalPoints += result.roundPoints;
      return result;
    });
    if (teams.length > 0) {
      // The round goes to the team with the most points; a tie goes to nobody.
      const best = Math.max(...teams.map((t) => t.roundPoints));
      const winners = teams.filter((t) => t.roundPoints === best);
      if (winners.length === 1) room.team(winners[0].team).roundsWon += 1;
    }
    const teamStandings: TeamStanding[] = computeTeamStandings(
      room.teams.map((team) => ({
        team: team.id,
        name: team.name,
        color: team.color,
        total: team.totalPoints,
        roundsWon: team.roundsWon,
        gamesWon: team.gamesWon,
      })),
    );

    // Nobody left to play for: the game ends here instead of starting a round
    // into an empty room (docs/context/02-game-rules.md).
    const abandoned = room.connectedPlayers().length === 0;
    const isLast = room.currentRound >= rounds || abandoned || options.final === true;
    if (isLast) this.awardGame(room, teamStandings);
    const payload: RoundEndPayload = {
      round: room.currentRound,
      totalRounds: rounds,
      mode,
      game,
      word: room.word ?? '',
      phrase: phrase?.display ?? null,
      // The word is public from here on: every board can show its letters.
      boards: room.players.map((player) => ({
        playerId: player.id,
        name: player.name,
        team: player.team,
        rows: player.round
          ? player.round.rows.map((row) => ({ word: row.word, colors: [...row.colors] }))
          : [],
        solved: player.round?.solved ?? false,
      })),
      breakdown,
      standings,
      teams,
      teamStandings,
      nextRoundIn: isLast ? 0 : ROOM_LIMITS.betweenRoundsSeconds,
      // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
      bossDefeated,
      boss:
        bot?.round != null
          ? {
              solved: bot.round.solved,
              attempts: bot.round.attempt,
              defeated: !bot.round.solved,
              secondsLeft: bot.round.secondsLeft(now),
              rows: bot.round.rows.map((row) => ({ word: row.word, colors: [...row.colors] })),
            }
          : null,
      // BOSS-MODE — end.
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
        payload: { standings, teamStandings, rounds },
      });
      const early =
        room.currentRound < rounds
          ? abandoned
            ? ', nobody connected'
            : ', a whole team left'
          : null;
      this.logger.log(
        early === null
          ? `Room ${room.code}: game finished after ${rounds} round(s)`
          : `Room ${room.code}: game finished early${early}`,
      );
    } else {
      room.status = 'between-rounds';
      const delayMs = ROOM_LIMITS.betweenRoundsSeconds * 1000;
      room.nextRoundAt = now + delayMs;
      this.scheduler.schedule(room.code, delayMs, () => this.startNextRound(room.code));
    }
    return payload;
  }

  /**
   * Ends the game with no round to score: the standings as they stand, the
   * game counter and `game:end`. Used when the room stops being playable
   * between rounds — in team mode, when the last member of a team leaves
   * (docs/context/06-v1.1.md -> Teams).
   */
  endGameNow(room: Room, now: number): void {
    const { rounds, mode } = room.settings;
    const teamMode = mode === 'teams';
    const standings = teamMode
      ? []
      : computeStandings(
          room.players.map((p) => ({
            playerId: p.id,
            name: p.name,
            total: p.totalPoints,
            attempts: p.totalAttempts,
            hintsUsed: p.hintsUsed,
          })),
        );
    const teamStandings = computeTeamStandings(
      room.teams.map((team) => ({
        team: team.id,
        name: team.name,
        color: team.color,
        total: team.totalPoints,
        roundsWon: team.roundsWon,
        gamesWon: team.gamesWon,
      })),
    );
    this.awardGame(room, teamStandings);
    // Whatever was about to start does not: the room is finished from here.
    this.scheduler.cancel(room.code);
    room.status = 'finished';
    room.finishedAt = now;
    room.nextRoundAt = null;
    room.touch(now);
    this.bus.publish({
      roomCode: room.code,
      event: 'game:end',
      payload: { standings, teamStandings, rounds },
    });
    this.logger.log(`Room ${room.code}: game finished early after round ${room.currentRound}`);
  }

  /**
   * The game goes to the team with the most points; the counter outlives the
   * game, so it is bumped on the very payload that announces the result.
   */
  private awardGame(room: Room, teamStandings: TeamStanding[]): void {
    if (teamStandings.length === 0) return;
    const [first, second] = teamStandings;
    if (first && (!second || second.total < first.total)) {
      room.team(first.team).gamesWon += 1;
      first.gamesWon += 1;
    }
  }

  private startNextRound(roomCode: string): void {
    const room = this.rooms.findByCode(roomCode);
    // The room may have been deleted (everyone left) while waiting.
    if (!room || room.status !== 'between-rounds') return;
    this.startRound.execute(room, this.clock.now());
  }
}
