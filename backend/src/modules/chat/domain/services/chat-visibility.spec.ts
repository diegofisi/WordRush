import type { ChatMessage } from '@shared/contract';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { TeamRound } from '@modules/rooms/domain/entities/team.entity';
import { canRead, canSend } from './chat-visibility';

const T0 = 1_000_000;

const settings = (mode: 'normal' | 'teams') => ({
  language: 'es' as const,
  mode,
  wordLength: 5 as const,
  initialSeconds: 60,
  rounds: 3,
  capacity: 8,
  hintEnabled: true,
});

const person = (id: string, role: 'player' | 'observer' = 'player') =>
  Player.create({ id, token: 't', name: id, isHost: id === 'ana', joinedAt: T0, role });

const message = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 1,
  round: 1,
  playerId: 'x',
  name: 'x',
  observer: false,
  team: null,
  channel: 'all',
  text: 'hi',
  at: T0,
  duringPlay: true,
  ...over,
});

describe('chat visibility · normal mode', () => {
  let room: Room;
  let ana: Player;
  let bruno: Player;
  let obs: Player;

  beforeEach(() => {
    room = Room.create('ABCD', settings('normal'), T0);
    ana = person('ana');
    bruno = person('bruno');
    obs = person('obs', 'observer');
    room.addPlayer(ana);
    room.addPlayer(bruno);
    room.addObserver(obs);
    room.status = 'playing';
    room.currentRound = 1;
    for (const p of room.players) p.round = new PlayerRound(T0, 60, 5);
  });

  it('keeps players still guessing out of the talk, observers in', () => {
    expect(canSend(room, ana, 'all')).toBe(false);
    expect(canSend(room, obs, 'all')).toBe(true);
    const fromObserver = message({ playerId: 'obs', observer: true });
    expect(canRead(room, ana, fromObserver)).toBe(false);
    expect(canRead(room, obs, fromObserver)).toBe(true);
  });

  it('lets a player in once they finish the round', () => {
    ana.round?.finish('attempts', T0 + 1000);
    expect(canSend(room, ana, 'all')).toBe(true);
    expect(canRead(room, ana, message({ playerId: 'obs' }))).toBe(true);
    expect(canRead(room, bruno, message({ playerId: 'obs' }))).toBe(false);
  });

  it('turns the round talk into history for everybody once the round ends', () => {
    const hidden = message({ playerId: 'obs', round: 1, duringPlay: true });
    room.status = 'between-rounds';
    expect(canRead(room, bruno, hidden)).toBe(true);
    room.status = 'playing';
    room.currentRound = 2;
    expect(canRead(room, bruno, hidden)).toBe(true);
  });

  it('has no team channel outside team mode', () => {
    expect(canSend(room, ana, 'team')).toBe(false);
  });
});

describe('chat visibility · team mode', () => {
  let room: Room;
  let ana: Player;
  let bruno: Player;
  let carla: Player;
  let obs: Player;

  beforeEach(() => {
    room = Room.create('ABCD', settings('teams'), T0);
    ana = person('ana');
    bruno = person('bruno');
    carla = person('carla');
    obs = person('obs', 'observer');
    room.addPlayer(ana); // a
    room.addPlayer(bruno); // b
    room.addPlayer(carla); // a
    room.addObserver(obs);
    room.status = 'playing';
    room.currentRound = 1;
    for (const team of room.teams) team.round = new TeamRound(T0, 60, 5);
    for (const p of room.players) {
      p.round = new PlayerRound(T0, 60, 5, room.teamOf(p)?.round ?? null);
    }
  });

  it('opens the team channel to the team from the first second, to nobody else', () => {
    expect(canSend(room, ana, 'team')).toBe(true);
    expect(canSend(room, obs, 'team')).toBe(false);
    const fromAna = message({ playerId: 'ana', team: 'a', channel: 'team' });
    expect(canRead(room, carla, fromAna)).toBe(true);
    expect(canRead(room, bruno, fromAna)).toBe(false);
    expect(canRead(room, obs, fromAna)).toBe(false);
  });

  it('counts "finished" as the whole team being done', () => {
    // Ana is out of attempts but Carla still plays: the team is not done.
    ana.round?.finish('attempts', T0 + 1000);
    expect(canSend(room, ana, 'all')).toBe(false);
    room.team('a').round?.finish('solved', T0 + 2000);
    expect(canSend(room, ana, 'all')).toBe(true);
    expect(canSend(room, carla, 'all')).toBe(true);
    expect(canSend(room, bruno, 'all')).toBe(false);
  });
});
