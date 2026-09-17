import { type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { type OutboundEvent, RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '../../domain/entities/player-round.entity';
import { Player } from '../../domain/entities/player.entity';
import { Room } from '../../domain/entities/room.entity';
import { ROOM_LIFECYCLE } from '../../domain/room-lifecycle';
import { toFullState } from '../../domain/services/state-presenter';
import { InMemoryRoomRepository } from '../../infrastructure/repositories/in-memory-room.repository';
import { RoomJanitorService } from '../services/room-janitor.service';
import { RejoinRoomDto } from '../dtos/rejoin-room.dto';
import { RejoinRoomUseCase } from './rejoin-room.use-case';

const T0 = 1_000_000;

class FakeClock implements Clock {
  current = T0;
  now(): number {
    return this.current;
  }
}

const dto = (over: Partial<RejoinRoomDto> = {}): RejoinRoomDto =>
  Object.assign(new RejoinRoomDto(), {
    roomCode: 'ABCD',
    playerId: 'p1',
    token: 'secret-token',
    ...over,
  });

describe('RejoinRoomUseCase', () => {
  let rooms: InMemoryRoomRepository;
  let clock: FakeClock;
  let bus: RoomEventsBus;
  let events: OutboundEvent[];
  let useCase: RejoinRoomUseCase;
  let room: Room;

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    clock = new FakeClock();
    bus = new RoomEventsBus();
    events = [];
    bus.subscribe((e) => events.push(e));
    useCase = new RejoinRoomUseCase(rooms, clock, bus);

    room = Room.create(
      'ABCD',
      {
        language: 'es',
        game: 'wordle',
        mode: 'normal',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 3,
        capacity: 8,
        hintEnabled: true,
      },
      T0,
    );
    room.addPlayer(
      Player.create({
        id: 'p1',
        token: 'secret-token',
        name: 'Ana',
        isHost: true,
        joinedAt: T0,
      }),
    );
    rooms.save(room);
  });

  it('re-attaches a disconnected player and announces the lobby', () => {
    room.findPlayer('p1')!.markDisconnected(T0);
    clock.current = T0 + 5_000;

    const session = useCase.execute(dto());

    expect(session.room).toBe(room);
    expect(session.player.connected).toBe(true);
    expect(session.player.disconnectedAt).toBeNull();
    expect(room.lastActivityAt).toBe(T0 + 5_000);
    expect(events.map((e) => e.event)).toEqual(['lobby:update']);
  });

  it('answers room_not_found when the room is gone', () => {
    rooms.delete('ABCD');
    expect(() => useCase.execute(dto())).toThrow(new DomainException('room_not_found'));
  });

  it('answers session_expired when the token does not match', () => {
    expect(() => useCase.execute(dto({ token: 'wrong-token' }))).toThrow(
      new DomainException('session_expired'),
    );
    // A token of a different length must not leak through the comparison either.
    expect(() => useCase.execute(dto({ token: 'x' }))).toThrow(
      new DomainException('session_expired'),
    );
  });

  it('answers session_expired when the player was removed from the room', () => {
    room.removePlayer('p1');
    expect(() => useCase.execute(dto())).toThrow(new DomainException('session_expired'));
  });

  /**
   * docs/context/02-game-rules.md -> "Disconnections and room lifetime":
   * being away is not leaving, however long it lasts. A phone that locked its
   * screen for five minutes comes back to the same seat.
   */
  describe('after five minutes away', () => {
    const FIVE_MINUTES = 5 * 60_000;
    let janitor: RoomJanitorService;

    beforeEach(() => {
      janitor = new RoomJanitorService(rooms, clock);
      room.addPlayer(
        Player.create({ id: 'p2', token: 't-p2', name: 'Bruno', isHost: false, joinedAt: T0 }),
      );
    });

    /** Every janitor pass of those five minutes, as it would really run. */
    const sweepFiveMinutes = () => {
      for (let t = T0; t <= T0 + FIVE_MINUTES; t += ROOM_LIFECYCLE.janitorIntervalMs) {
        janitor.sweep(t);
      }
      clock.current = T0 + FIVE_MINUTES;
    };

    it('gives the lobby seat back, same player id and same token', () => {
      room.findPlayer('p1')!.markDisconnected(T0);

      sweepFiveMinutes();
      // Still listed, still host, only marked away.
      expect(room.players.map((p) => p.id)).toEqual(['p1', 'p2']);
      expect(room.findPlayer('p1')!.connected).toBe(false);

      const session = useCase.execute(dto());

      expect(session.player.id).toBe('p1');
      expect(session.player.token).toBe('secret-token');
      expect(session.player.isHost).toBe(true);
      expect(session.player.connected).toBe(true);
      const state = toFullState(room, session.player, clock.current);
      expect(state.lobby.players.map((p) => [p.id, p.connected])).toEqual([
        ['p1', true],
        ['p2', true],
      ]);
      expect(state.round).toBeNull();
    });

    it('gives the board and the clock back when the game is still running', () => {
      // A ten-minute round, so the clock has not run out while they were away.
      room.updateSettings({ ...room.settings, initialSeconds: 600 });
      room.status = 'playing';
      room.currentRound = 2;
      room.word = 'sillas';
      room.roundStartedAt = T0;
      for (const player of room.players) player.round = new PlayerRound(T0, 600, 5);
      const round = room.findPlayer('p1')!.round!;
      round.rows.push({ word: 'salir', colors: ['green', 'gray', 'yellow', 'gray', 'gray'] });
      room.findPlayer('p1')!.markDisconnected(T0);

      sweepFiveMinutes();
      const session = useCase.execute(dto());

      const state = toFullState(room, session.player, clock.current);
      expect(state.round).not.toBeNull();
      expect(state.round!.round).toBe(2);
      expect(state.round!.me.rows.map((r) => r.word)).toEqual(['salir']);
      // The clock never stopped: five of the ten minutes are gone.
      expect(state.round!.me.secondsLeft).toBeCloseTo(300, 0);
      expect(state.round!.me.finished).toBe(false);
      // And the word is still nowhere on the wire.
      expect(JSON.stringify(state)).not.toContain('sillas');
    });
  });
});
