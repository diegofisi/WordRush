import { BOSS } from '@shared/contract';
import { type Clock } from '@shared/domain/clock';
import { type OutboundEvent, RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { InMemoryRoomRepository } from '@modules/rooms/infrastructure/repositories/in-memory-room.repository';
import { createBossSeat } from '@modules/rooms/domain/services/boss-seat';
import { EndRoundUseCase } from '../use-cases/end-round.use-case';
import { StartRoundUseCase } from '../use-cases/start-round.use-case';
import { RoundLifecycleService } from './round-lifecycle.service';
import { RoundSchedulerService } from './round-scheduler.service';

const ANSWER = 'plaza';
const T0 = 1_000_000;

class FakeClock implements Clock {
  current = T0;
  now(): number {
    return this.current;
  }
}

/**
 * The inverted attack is the whole of boss mode, so it gets its own file:
 * humans never damage each other, and only the fly damages humans.
 * docs/context/06-boss-mode.md
 */
describe('RoundLifecycleService.announceSolve in boss mode', () => {
  let rooms: InMemoryRoomRepository;
  let bus: RoomEventsBus;
  let events: OutboundEvent[];
  let room: Room;
  let lifecycle: RoundLifecycleService;
  let scheduler: RoundSchedulerService;
  let bot: Player;

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    const clock = new FakeClock();
    bus = new RoomEventsBus();
    events = [];
    bus.subscribe((e) => events.push(e));

    scheduler = new RoundSchedulerService();
    const startRound = new StartRoundUseCase({ pick: () => ANSWER }, bus);
    const endRound = new EndRoundUseCase(rooms, clock, bus, scheduler, startRound);
    lifecycle = new RoundLifecycleService(bus, endRound);

    room = Room.create(
      'ABCD',
      {
        language: 'es',
        initialSeconds: 90,
        rounds: 3,
        capacity: 8,
        hintEnabled: true,
        bossMode: true,
      },
      T0,
    );
    room.status = 'playing';
    room.word = ANSWER;
    room.currentRound = 1;
    room.roundStartedAt = T0;

    for (const id of ['ana', 'bruno', 'carla']) {
      const player = Player.create({
        id,
        token: `t-${id}`,
        name: id,
        isHost: id === 'ana',
        joinedAt: T0,
      });
      player.round = new PlayerRound(T0, 90);
      room.addPlayer(player);
    }
    bot = createBossSeat(T0);
    bot.round = new PlayerRound(T0, 41);
    room.addPlayer(bot);
    rooms.save(room);
  });

  afterEach(() => scheduler.onModuleDestroy());

  const roundOf = (id: string) => room.findPlayer(id)!.round!;

  it('sends the whole hit to the fly and leaves the other humans untouched', () => {
    const ana = room.findPlayer('ana')!;
    ana.round!.markSolved(1, T0);

    lifecycle.announceSolve(room, ana, T0);

    expect(bot.round!.penaltySeconds).toBe(BOSS.damageOnHumanSolve);
    expect(roundOf('bruno').penaltySeconds).toBe(0);
    expect(roundOf('carla').penaltySeconds).toBe(0);
  });

  it('reports only the fly in the penalty payload', () => {
    const ana = room.findPlayer('ana')!;
    ana.round!.markSolved(1, T0);

    lifecycle.announceSolve(room, ana, T0);

    const penalty = events.find((e) => e.event === 'time:penalty');
    expect(penalty).toBeDefined();
    const payload = penalty!.payload as { seconds: number; clocks: { playerId: string }[] };
    expect(payload.seconds).toBe(BOSS.damageOnHumanSolve);
    expect(payload.clocks.map((c) => c.playerId)).toEqual([bot.id]);
  });

  it('stacks damage as the team solves one after another', () => {
    for (const id of ['ana', 'bruno', 'carla']) {
      const player = room.findPlayer(id)!;
      room.solvedCount += 1;
      player.round!.markSolved(room.solvedCount, T0);
      lifecycle.announceSolve(room, player, T0);
    }

    expect(bot.round!.penaltySeconds).toBe(3 * BOSS.damageOnHumanSolve);
  });

  it('sends the fly solving at every unsolved human and never at herself', () => {
    roundOf('carla').markSolved(1, T0);
    room.solvedCount = 1;
    room.solvedCount += 1;
    bot.round!.markSolved(room.solvedCount, T0);

    lifecycle.announceSolve(room, bot, T0);

    expect(roundOf('ana').penaltySeconds).toBe(5);
    expect(roundOf('bruno').penaltySeconds).toBe(5);
    // Already solved: her clock is frozen and out of reach.
    expect(roundOf('carla').penaltySeconds).toBe(0);
    expect(bot.round!.penaltySeconds).toBe(0);
  });

  it('still damages every rival when boss mode is off', () => {
    room.settings.bossMode = false;
    const ana = room.findPlayer('ana')!;
    ana.round!.markSolved(1, T0);

    lifecycle.announceSolve(room, ana, T0);

    expect(roundOf('bruno').penaltySeconds).toBe(5);
    expect(roundOf('carla').penaltySeconds).toBe(5);
  });
});
