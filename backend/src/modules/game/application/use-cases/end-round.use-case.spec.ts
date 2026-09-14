import { type Clock } from '@shared/domain/clock';
import { type OutboundEvent, RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { InMemoryRoomRepository } from '@modules/rooms/infrastructure/repositories/in-memory-room.repository';
import { RoundSchedulerService } from '../services/round-scheduler.service';
import { EndRoundUseCase } from './end-round.use-case';
import { StartRoundUseCase } from './start-round.use-case';

const ANSWER = 'solid';
const T0 = 1_000_000;

class FakeClock implements Clock {
  current = T0;
  now(): number {
    return this.current;
  }
}

describe('EndRoundUseCase', () => {
  let rooms: InMemoryRoomRepository;
  let clock: FakeClock;
  let bus: RoomEventsBus;
  let events: OutboundEvent[];
  let scheduler: RoundSchedulerService;
  let useCase: EndRoundUseCase;
  let room: Room;

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    clock = new FakeClock();
    bus = new RoomEventsBus();
    events = [];
    bus.subscribe((e) => events.push(e));
    scheduler = new RoundSchedulerService();
    const startRound = new StartRoundUseCase({ pick: () => ANSWER }, bus);
    useCase = new EndRoundUseCase(rooms, clock, bus, scheduler, startRound);

    room = Room.create(
      'ABCD',
      {
        language: 'es',
        initialSeconds: 60,
        rounds: 3,
        capacity: 8,
        hintEnabled: true,
        bossMode: false,
      },
      T0,
    );
    room.status = 'playing';
    room.word = ANSWER;
    room.currentRound = 1;
    room.roundStartedAt = T0;
    for (const id of ['a', 'b']) {
      const player = Player.create({
        id,
        token: `t-${id}`,
        name: id,
        isHost: id === 'a',
        joinedAt: T0,
      });
      player.round = new PlayerRound(T0, 60);
      player.round.finish('timeout', T0);
      room.addPlayer(player);
    }
    rooms.save(room);
  });

  afterEach(() => scheduler.onModuleDestroy());

  const names = () => events.map((e) => e.event);

  it('schedules the next round while somebody is still connected', () => {
    room.findPlayer('b')!.markDisconnected(T0);

    const payload = useCase.execute(room, T0);

    expect(payload.nextRoundIn).toBeGreaterThan(0);
    expect(room.status).toBe('between-rounds');
    expect(names()).toContain('round:end');
    expect(names()).not.toContain('game:end');
  });

  it('ends the game instead of starting a round into an empty room', () => {
    room.players.forEach((p) => p.markDisconnected(T0));

    const payload = useCase.execute(room, T0);

    expect(payload.nextRoundIn).toBe(0);
    expect(room.status).toBe('finished');
    expect(room.finishedAt).toBe(T0);
    expect(room.nextRoundAt).toBeNull();
    expect(room.currentRound).toBe(1);
    // Nobody hears it, and that is fine: the room is now on the finished TTL.
    expect(names()).toEqual(['round:end', 'game:end']);
  });

  it('ends the game after the configured last round', () => {
    room.currentRound = 3;

    const payload = useCase.execute(room, T0);

    expect(payload.nextRoundIn).toBe(0);
    expect(room.status).toBe('finished');
    expect(names()).toEqual(['round:end', 'game:end']);
  });
});
