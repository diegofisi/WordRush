import { Logger } from '@nestjs/common';
import { type Clock } from '@shared/domain/clock';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { InMemoryRoomRepository } from '@modules/rooms/infrastructure/repositories/in-memory-room.repository';
import { RoundLifecycleService } from '../services/round-lifecycle.service';
import { RoundSchedulerService } from '../services/round-scheduler.service';
import { EndRoundUseCase } from './end-round.use-case';
import { StartRoundUseCase } from './start-round.use-case';
import { TickRoomsUseCase } from './tick-rooms.use-case';

const ANSWER = 'solid';
const T0 = 1_000_000;

class FakeClock implements Clock {
  current = T0;
  now(): number {
    return this.current;
  }
}

const settings = {
  language: 'es' as const,
  mode: 'normal' as const,
  wordLength: 5 as const,
  initialSeconds: 60,
  rounds: 3,
  capacity: 8,
  hintEnabled: true,
};

describe('TickRoomsUseCase', () => {
  let rooms: InMemoryRoomRepository;
  let lifecycle: RoundLifecycleService;
  let useCase: TickRoomsUseCase;
  let logged: jest.SpyInstance;

  /** A room in mid-round, saved in insertion order. */
  const makeRoom = (code: string, status: Room['status'] = 'playing'): Room => {
    const room = Room.create(code, settings, T0);
    const player = Player.create({
      id: `${code}-a`,
      token: `t-${code}`,
      name: code,
      isHost: true,
      joinedAt: T0,
    });
    player.round = new PlayerRound(T0, 60, 5);
    room.addPlayer(player);
    room.status = status;
    room.word = ANSWER;
    room.currentRound = 1;
    room.roundStartedAt = T0;
    rooms.save(room);
    return room;
  };

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    const clock = new FakeClock();
    const bus = new RoomEventsBus();
    const scheduler = new RoundSchedulerService();
    const startRound = new StartRoundUseCase({ pick: () => ANSWER }, bus);
    const endRound = new EndRoundUseCase(rooms, clock, bus, scheduler, startRound);
    lifecycle = new RoundLifecycleService(bus, endRound);
    useCase = new TickRoomsUseCase(rooms, lifecycle);
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ticks the rooms that are playing and leaves the others alone', () => {
    const seen: string[] = [];
    jest.spyOn(lifecycle, 'finishTimedOut').mockImplementation((room) => {
      seen.push(room.code);
      return [];
    });
    makeRoom('WAIT', 'lobby');
    makeRoom('PLAY');
    makeRoom('DONE', 'finished');

    useCase.execute(T0);

    expect(seen).toEqual(['PLAY']);
  });

  it('keeps ticking the rooms that come after one that throws', () => {
    const seen: string[] = [];
    jest.spyOn(lifecycle, 'finishTimedOut').mockImplementation((room) => {
      if (room.code === 'BAD1') throw new Error('boom');
      seen.push(room.code);
      return [];
    });
    // Insertion order is the point: with the guard around the loop instead of
    // inside it, OK02 is never reached again on any tick.
    makeRoom('OK01');
    makeRoom('BAD1');
    makeRoom('OK02');

    expect(() => useCase.execute(T0)).not.toThrow();

    expect(seen).toEqual(['OK01', 'OK02']);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('reports a permanently broken room once instead of on every tick', () => {
    jest.spyOn(lifecycle, 'finishTimedOut').mockImplementation(() => {
      throw new Error('boom');
    });
    makeRoom('BAD1');

    useCase.execute(T0);
    useCase.execute(T0 + 250);
    useCase.execute(T0 + 500);

    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('reports the room again after it recovers and breaks a second time', () => {
    let broken = true;
    jest.spyOn(lifecycle, 'finishTimedOut').mockImplementation(() => {
      if (broken) throw new Error('boom');
      return [];
    });
    makeRoom('FLAP');

    useCase.execute(T0);
    broken = false;
    useCase.execute(T0 + 250);
    broken = true;
    useCase.execute(T0 + 500);

    expect(logged).toHaveBeenCalledTimes(2);
  });
});
