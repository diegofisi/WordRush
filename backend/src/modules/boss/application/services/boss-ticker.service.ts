import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CLOCK, type Clock } from '@shared/domain/clock';
import {
  IRoomRepository,
  ROOM_REPOSITORY,
} from '@modules/rooms/domain/interfaces/room-repository.interface';
import { BossPlayTurnUseCase } from '../use-cases/boss-play-turn.use-case';
import type { Player } from '@modules/rooms/domain/entities/player.entity';
import type { LetterState, SlotState } from '../../domain/services/boss-wiring';
import { BossMemoryService } from './boss-memory.service';
import { BossWatchersService } from './boss-watchers.service';
import {
  BOSS_BRAIN_STREAM,
  type IBossBrainStream,
} from '../../domain/interfaces/boss-brain.interface';
import { RoomEventsBus } from '@shared/events/room-events.bus';

/**
 * Drives the fly. Separate from the game's own ticker on purpose: she is an
 * optional mode and nothing in `game` is allowed to know she exists, so she
 * brings her own clock rather than hooking into theirs.
 */
export const BOSS_TICK_INTERVAL_MS = 200;

@Injectable()
export class BossTickerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BossTickerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: IRoomRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly playTurn: BossPlayTurnUseCase,
    private readonly memory: BossMemoryService,
    private readonly watchers: BossWatchersService,
    @Inject(BOSS_BRAIN_STREAM) private readonly brain: IBossBrainStream,
    private readonly bus: RoomEventsBus,
  ) {}

  private streamedRoom: string | null = null;

  onModuleInit(): void {
    // Live slices go straight out to the room that asked for them.
    this.brain.subscribe((frame) => {
      const room = this.streamedRoom;
      if (room) this.bus.publish({ roomCode: room, event: 'boss:frame', payload: frame });
    });
    this.timer = setInterval(() => this.tick(), BOSS_TICK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Points the live stream at the room somebody is watching, and stops it when
   * nobody is. The board she is looking at is pushed with it so the stream
   * reflects the position, not a blank brain.
   */
  private syncStream(): void {
    const wanted = this.watchers.onlyRoom();
    if (wanted === this.streamedRoom) {
      if (wanted) this.pointStream(wanted);
      return;
    }
    if (this.streamedRoom && !wanted) this.brain.stream(false);
    this.streamedRoom = wanted;
    if (wanted) this.pointStream(wanted, true);
  }

  private pointStream(roomCode: string, turnOn = false): void {
    const room = this.rooms.findByCode(roomCode);
    const bot = room?.bot;
    if (!room || !bot?.round || !room.settings.bossMode) {
      if (turnOn) this.brain.stream(false);
      return;
    }
    this.brain.stream(true, {
      slots: slotsOfRound(bot.round),
      letters: lettersOfRound(bot.round),
    });
  }

  /**
   * A throwing interval handler kills the process, so nothing escapes here.
   *
   * A turn is asynchronous now: the brain answers from its own thread after
   * about half a second. The turn itself refuses to start a second simulation
   * while one is in flight, so the tick can fire straight through it.
   */
  tick(): void {
    try {
      const now = this.clock.now();
      const live = new Set<string>();
      for (const room of this.rooms.all()) {
        live.add(room.code);
        if (!room.settings.bossMode || room.status !== 'playing') continue;
        const bot = room.bot;
        if (!bot) continue;
        void this.playTurn.execute(room, bot, now).catch((error: unknown) => {
          this.logger.error(
            `Boss turn failed in room ${room.code}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
      }
      this.memory.prune(live);
      this.syncStream();
    } catch (error) {
      this.logger.error('Boss tick failed', error instanceof Error ? error.stack : String(error));
    }
  }
}

/** Her board as the brain sees it: one colour per slot. */
function slotsOfRound(round: NonNullable<Player['round']>): SlotState[] {
  const slots: SlotState[] = ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'];
  for (const row of round.rows) {
    for (let i = 0; i < row.colors.length; i += 1) {
      const colour = row.colors[i];
      if (colour === 'green') slots[i] = 'green';
      else if (slots[i] !== 'green') slots[i] = colour === 'yellow' ? 'yellow' : 'gray';
    }
  }
  return slots;
}

/** Her keyboard: what every letter she has spent turned out to be. */
function lettersOfRound(round: NonNullable<Player['round']>): [string, LetterState][] {
  const state = new Map<string, LetterState>();
  for (const row of round.rows) {
    for (let i = 0; i < row.colors.length; i += 1) {
      const letter = row.word[i];
      if (letter === undefined) continue;
      if (row.colors[i] === 'gray') {
        if (!state.has(letter)) state.set(letter, 'absent');
      } else {
        state.set(letter, 'present');
      }
    }
  }
  return [...state];
}
