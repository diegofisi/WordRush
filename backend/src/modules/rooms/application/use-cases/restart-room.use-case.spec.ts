import type { LobbyState, RoomSettings } from '@shared/contract';
import { type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { type OutboundEvent, RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '../../domain/entities/player-round.entity';
import { Player } from '../../domain/entities/player.entity';
import { Room } from '../../domain/entities/room.entity';
import { InMemoryRoomRepository } from '../../infrastructure/repositories/in-memory-room.repository';
import { RestartRoomUseCase } from './restart-room.use-case';

const T0 = 1_000_000;
const LATER = T0 + 5 * 60_000;

class FakeClock implements Clock {
  current = LATER;
  now(): number {
    return this.current;
  }
}

const SETTINGS: RoomSettings = {
  bossMode: false,
  language: 'en',
  initialSeconds: 120,
  rounds: 3,
  capacity: 5,
  hintEnabled: false,
};

describe('RestartRoomUseCase', () => {
  let rooms: InMemoryRoomRepository;
  let clock: FakeClock;
  let bus: RoomEventsBus;
  let events: OutboundEvent[];
  let useCase: RestartRoomUseCase;
  let room: Room;

  const addPlayer = (id: string, isHost = false) => {
    const player = Player.create({ id, token: `t-${id}`, name: id, isHost, joinedAt: T0 });
    room.addPlayer(player);
    return player;
  };

  /** A room as `EndRoundUseCase` leaves it after the last round. */
  const finishGame = () => {
    room.status = 'finished';
    room.finishedAt = T0;
    room.currentRound = 3;
    room.word = 'ahora';
    room.usedWords.push('ahora', 'vamos', 'reloj');
    room.roundStartedAt = T0;
    room.solvedCount = 2;
    room.lastRoundEnd = {
      round: 3,
      totalRounds: 3,
      word: 'ahora',
      breakdown: [],
      standings: [],
      nextRoundIn: 0,
      bossDefeated: null,
      boss: null,
    };
    for (const player of room.players) {
      player.ready = true;
      player.totalPoints = 120;
      player.totalAttempts = 9;
      player.hintsUsed = 2;
      player.round = new PlayerRound(T0, SETTINGS.initialSeconds);
    }
  };

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    clock = new FakeClock();
    bus = new RoomEventsBus();
    events = [];
    bus.subscribe((event) => events.push(event));
    useCase = new RestartRoomUseCase(rooms, clock, bus);

    room = Room.create('ABCD', { ...SETTINGS }, T0);
    rooms.save(room);
    addPlayer('host', true);
    addPlayer('guest');
  });

  it('turns the finished room back into its own lobby, with the standings zeroed', () => {
    finishGame();

    useCase.execute('ABCD', 'host');

    expect(room.status).toBe('lobby');
    expect(room.code).toBe('ABCD');
    expect(room.settings).toEqual(SETTINGS);
    expect(room.players.map((p) => p.id)).toEqual(['host', 'guest']);
    expect(room.host?.id).toBe('host');
    expect(room.currentRound).toBe(0);
    expect(room.word).toBeNull();
    expect(room.usedWords).toEqual([]);
    expect(room.lastRoundEnd).toBeNull();
    expect(room.solvedCount).toBe(0);
    expect(room.roundStartedAt).toBe(0);
    for (const player of room.players) {
      expect(player.ready).toBe(false);
      expect(player.totalPoints).toBe(0);
      expect(player.totalAttempts).toBe(0);
      expect(player.hintsUsed).toBe(0);
      expect(player.round).toBeNull();
    }
  });

  it('clears the fields the janitor reads, so the room is a lobby again', () => {
    finishGame();
    room.nextRoundAt = T0 + 12_000;
    room.emptiedAt = T0;

    useCase.execute('ABCD', 'host');

    expect(room.finishedAt).toBeNull();
    expect(room.nextRoundAt).toBeNull();
    expect(room.emptiedAt).toBeNull();
    expect(room.lastActivityAt).toBe(LATER);
  });

  it('broadcasts the new lobby to everybody', () => {
    finishGame();

    useCase.execute('ABCD', 'host');

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('lobby:update');
    expect(events[0].roomCode).toBe('ABCD');
    const lobby = events[0].payload as LobbyState;
    expect(lobby.status).toBe('lobby');
    expect(lobby.players.every((p) => !p.ready)).toBe(true);
  });

  it('keeps a disconnected player in the list and restarts their grace period', () => {
    finishGame();
    room.findPlayer('guest')!.markDisconnected(T0);

    useCase.execute('ABCD', 'host');

    const guest = room.findPlayer('guest')!;
    expect(guest).toBeDefined();
    expect(guest.connected).toBe(false);
    // The lobby grace runs from the restart, not from a disconnection five minutes old.
    expect(guest.disconnectedAt).toBe(LATER);
    expect(room.toLobbyState().players.map((p) => p.id)).toEqual(['host', 'guest']);
  });

  it('refuses a guest', () => {
    finishGame();

    expect(() => useCase.execute('ABCD', 'guest')).toThrow(new DomainException('not_host'));
    expect(room.status).toBe('finished');
    expect(events).toHaveLength(0);
  });

  it('refuses while the round is being played', () => {
    room.status = 'playing';

    let thrown: DomainException | null = null;
    try {
      useCase.execute('ABCD', 'host');
    } catch (error) {
      thrown = error as DomainException;
    }

    expect(thrown?.code).toBe('game_in_progress');
    expect(thrown?.message).toBe('The game has not finished yet');
    expect(room.status).toBe('playing');
  });

  it('refuses between rounds: the game is still running', () => {
    room.status = 'between-rounds';
    room.currentRound = 1;

    expect(() => useCase.execute('ABCD', 'host')).toThrow(
      new DomainException('game_in_progress', 'The game has not finished yet'),
    );
    expect(room.status).toBe('between-rounds');
    expect(room.currentRound).toBe(1);
  });

  it('refuses from the lobby it already is', () => {
    expect(() => useCase.execute('ABCD', 'host')).toThrow(
      new DomainException('game_in_progress', 'The game has not finished yet'),
    );
  });

  it('refuses somebody who is not in the room', () => {
    finishGame();

    expect(() => useCase.execute('ABCD', 'ghost')).toThrow(new DomainException('not_in_room'));
    expect(() => useCase.execute('ZZZZ', 'host')).toThrow(new DomainException('not_in_room'));
  });
});
