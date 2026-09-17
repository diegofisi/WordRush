import { type Clock } from '@shared/domain/clock';
import { type OutboundEvent, RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { TeamRound } from '@modules/rooms/domain/entities/team.entity';
import { LeaveRoomUseCase } from '@modules/rooms/application/use-cases/leave-room.use-case';
import { InMemoryRoomRepository } from '@modules/rooms/infrastructure/repositories/in-memory-room.repository';
import type { RoomSettings } from '@shared/contract';
import { RoundLifecycleService } from '../services/round-lifecycle.service';
import { RoundSchedulerService } from '../services/round-scheduler.service';
import { EndRoundUseCase } from './end-round.use-case';
import { SettleRoundUseCase } from './settle-round.use-case';
import { StartRoundUseCase } from './start-round.use-case';

const ANSWER = 'solid';
const T0 = 1_000_000;
const SECONDS = 60;

class FakeClock implements Clock {
  current = T0;
  now(): number {
    return this.current;
  }
}

const settings = (mode: 'normal' | 'teams'): RoomSettings => ({
  language: 'es',
  game: 'wordle',
  mode,
  wordLength: 5,
  initialSeconds: SECONDS,
  rounds: 3,
  capacity: 8,
  hintEnabled: true,
});

/** docs/context/06-v1.1.md -> Teams: a team that walks out ends the game. */
describe('SettleRoundUseCase', () => {
  let rooms: InMemoryRoomRepository;
  let clock: FakeClock;
  let bus: RoomEventsBus;
  let events: OutboundEvent[];
  let scheduler: RoundSchedulerService;
  let leaveRoom: LeaveRoomUseCase;
  let useCase: SettleRoundUseCase;

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    clock = new FakeClock();
    bus = new RoomEventsBus();
    events = [];
    bus.subscribe((e) => events.push(e));
    scheduler = new RoundSchedulerService();
    const startRound = new StartRoundUseCase(
      { pick: () => ANSWER },
      { pick: () => 'mas vale tarde que nunca' },
      bus,
    );
    const endRound = new EndRoundUseCase(rooms, clock, bus, scheduler, startRound);
    const lifecycle = new RoundLifecycleService(bus, endRound);
    leaveRoom = new LeaveRoomUseCase(rooms, clock, bus);
    useCase = new SettleRoundUseCase(rooms, clock, lifecycle, endRound);
  });

  afterEach(() => scheduler.onModuleDestroy());

  const names = () => events.map((e) => e.event);

  /** `a` = Ana + Bruno, `b` = Carla; a round is running. */
  function teamRoom(): Room {
    const room = Room.create('ABCD', settings('teams'), T0);
    const seats: [string, string, 'a' | 'b'][] = [
      ['p1', 'Ana', 'a'],
      ['p2', 'Bruno', 'a'],
      ['p3', 'Carla', 'b'],
    ];
    for (const [id, name, team] of seats) {
      const player = Player.create({
        id,
        token: `t-${id}`,
        name,
        isHost: id === 'p1',
        joinedAt: T0,
      });
      room.addPlayer(player);
      player.team = team;
    }
    startRound(room);
    rooms.save(room);
    return room;
  }

  function startRound(room: Room): void {
    room.status = 'playing';
    room.currentRound = 1;
    room.word = ANSWER;
    room.roundStartedAt = T0;
    for (const team of room.teams) team.round = new TeamRound(T0, SECONDS, 5);
    for (const player of room.players) {
      player.round = new PlayerRound(T0, SECONDS, 5, room.teamOf(player)?.round ?? null);
    }
  }

  /** The room's real leave path: the gateway leaves, then settles. */
  function leave(room: Room, playerId: string): void {
    leaveRoom.execute(room.code, playerId);
    useCase.execute(room.code);
  }

  it('ends the game when the last member of a team leaves mid-round', () => {
    const room = teamRoom();
    // Team `a` solved this round; team `b` never did.
    room.team('a').round!.markSolved(1, 'p1', T0 + 10_000);
    room.players[0].round!.markSolved(1, T0 + 10_000);
    clock.current = T0 + 20_000;
    events = [];

    leave(room, 'p3');

    expect(names()).toContain('round:end');
    expect(names()).toContain('game:end');
    expect(names().indexOf('round:end')).toBeLessThan(names().indexOf('game:end'));
    expect(room.status).toBe('finished');
    expect(room.finishedAt).toBe(clock.current);
    // The round was scored as it stood: the solvers keep their points, the
    // team that walked out gets what an unsolved round is worth (nothing).
    expect(room.team('a').totalPoints).toBeGreaterThan(0);
    expect(room.team('b').totalPoints).toBe(0);
    const end = events.find((e) => e.event === 'game:end')!.payload as {
      teamStandings: { team: string; total: number }[];
    };
    expect(end.teamStandings[0].team).toBe('a');
    // Round 1 of 3, and the game is over: no next round was scheduled.
    expect(room.currentRound).toBe(1);
    expect(room.nextRoundAt).toBeNull();
  });

  it('does nothing special when a team still has a member', () => {
    const room = teamRoom();
    clock.current = T0 + 20_000;
    events = [];

    leave(room, 'p1');

    expect(names()).not.toContain('round:end');
    expect(names()).not.toContain('game:end');
    expect(room.status).toBe('playing');
    expect(room.members('a').map((p) => p.id)).toEqual(['p2']);
  });

  it('does nothing when a whole team merely disconnects', () => {
    const room = teamRoom();
    room.findPlayer('p3')!.markDisconnected(T0 + 5_000);
    clock.current = T0 + 20_000;
    events = [];

    useCase.execute(room.code);

    expect(names()).toEqual([]);
    expect(room.status).toBe('playing');
    // The seat is still there, waiting for them.
    expect(room.members('b').map((p) => p.id)).toEqual(['p3']);
  });

  it('ends the game when a team is emptied between rounds', () => {
    const room = teamRoom();
    room.status = 'between-rounds';
    room.nextRoundAt = T0 + 8_000;
    clock.current = T0 + 2_000;
    events = [];

    leave(room, 'p3');

    // No round was open, so there is nothing to score: only the game ends.
    expect(names()).not.toContain('round:end');
    expect(names()).toContain('game:end');
    expect(room.status).toBe('finished');
    expect(room.nextRoundAt).toBeNull();
  });

  it('leaves the normal mode alone: the round goes on without the leaver', () => {
    const room = Room.create('WXYZ', settings('normal'), T0);
    for (const [id, name] of [
      ['p1', 'Ana'],
      ['p2', 'Bruno'],
    ]) {
      room.addPlayer(
        Player.create({ id, token: `t-${id}`, name, isHost: id === 'p1', joinedAt: T0 }),
      );
    }
    startRound(room);
    rooms.save(room);
    clock.current = T0 + 20_000;
    events = [];

    leave(room, 'p2');

    expect(names()).not.toContain('round:end');
    expect(names()).not.toContain('game:end');
    expect(room.status).toBe('playing');
    expect(room.players.map((p) => p.id)).toEqual(['p1']);
  });
});
