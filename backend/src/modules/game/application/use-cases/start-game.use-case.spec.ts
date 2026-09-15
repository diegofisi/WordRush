import { type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { RoomEventsBus } from '@shared/events/room-events.bus';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { InMemoryRoomRepository } from '@modules/rooms/infrastructure/repositories/in-memory-room.repository';
import { StartGameUseCase } from './start-game.use-case';
import { StartRoundUseCase } from './start-round.use-case';

const ANSWER = 'solid';
const T0 = 1_000_000;

class FakeClock implements Clock {
  now(): number {
    return T0;
  }
}

describe('StartGameUseCase', () => {
  let rooms: InMemoryRoomRepository;
  let useCase: StartGameUseCase;
  let room: Room;

  const addPlayer = (id: string, isHost = false) => {
    const player = Player.create({ id, token: `t-${id}`, name: id, isHost, joinedAt: T0 });
    room.addPlayer(player);
    return player;
  };

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    const bus = new RoomEventsBus();
    const startRound = new StartRoundUseCase({ pick: () => ANSWER }, bus);
    useCase = new StartGameUseCase(rooms, new FakeClock(), startRound);

    // Capacity 8: the host may start well below it.
    room = Room.create(
      'ABCD',
      {
        language: 'es',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 3,
        capacity: 8,
        hintEnabled: true,
      },
      T0,
    );
    rooms.save(room);
  });

  it('starts with 2 connected players in a room of 8, nobody ready', () => {
    addPlayer('host', true);
    addPlayer('b');
    expect(room.players.every((p) => !p.ready)).toBe(true);

    useCase.execute('ABCD', 'host');

    expect(room.status).toBe('playing');
    expect(room.currentRound).toBe(1);
    expect(room.word).toBe(ANSWER);
    expect(room.players.every((p) => p.round !== null)).toBe(true);
  });

  it('rejects a start with a single connected player', () => {
    addPlayer('host', true);
    const ghost = addPlayer('b');
    ghost.markDisconnected(T0);

    expect(() => useCase.execute('ABCD', 'host')).toThrow(
      new DomainException('not_enough_players'),
    );
    expect(room.status).toBe('lobby');
  });

  it('rejects a start from someone who is not the host', () => {
    addPlayer('host', true);
    addPlayer('b');

    expect(() => useCase.execute('ABCD', 'b')).toThrow(new DomainException('not_host'));
    expect(room.status).toBe('lobby');
  });

  it('rejects a second start once the game is running', () => {
    addPlayer('host', true);
    addPlayer('b');
    useCase.execute('ABCD', 'host');

    expect(() => useCase.execute('ABCD', 'host')).toThrow(new DomainException('game_in_progress'));
  });
});
