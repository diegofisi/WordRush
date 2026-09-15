import type { RoomSettings, RoundEndPayload } from '@shared/contract';
import { Player } from '../entities/player.entity';
import { PlayerRound } from '../entities/player-round.entity';
import { Room } from '../entities/room.entity';
import { toFullState } from './state-presenter';

const SETTINGS: RoomSettings = {
  language: 'es',
  mode: 'normal',
  wordLength: 5,
  initialSeconds: 60,
  rounds: 3,
  capacity: 8,
  hintEnabled: true,
};

const roundEnd = (): RoundEndPayload => ({
  round: 1,
  totalRounds: 3,
  mode: 'normal',
  word: 'ahora',
  breakdown: [],
  standings: [],
  teams: [],
  teamStandings: [],
  nextRoundIn: 12,
});

const makeRoom = (now: number) => {
  const room = Room.create('ABCD', SETTINGS, now);
  const player = Player.create({ id: 'p1', token: 't', name: 'Ana', isHost: true, joinedAt: now });
  player.round = new PlayerRound(now, SETTINGS.initialSeconds, 5);
  room.addPlayer(player);
  room.currentRound = 1;
  room.lastRoundEnd = roundEnd();
  return { room, player };
};

describe('toFullState between rounds', () => {
  const now = 1_000_000;

  it('reports the countdown that is left, not the one stored when the round ended', () => {
    const { room, player } = makeRoom(now);
    room.status = 'between-rounds';
    room.nextRoundAt = now + 12_000;

    const fresh = toFullState(room, player, now);
    expect(fresh.lastRoundEnd?.nextRoundIn).toBe(12);

    const later = toFullState(room, player, now + 9_400);
    expect(later.lastRoundEnd?.nextRoundIn).toBe(3);
  });

  it('never reports 0 while a round is still coming (0 means "game over")', () => {
    const { room, player } = makeRoom(now);
    room.status = 'between-rounds';
    room.nextRoundAt = now + 12_000;

    expect(toFullState(room, player, now + 12_500).lastRoundEnd?.nextRoundIn).toBe(1);
  });

  it('leaves the payload untouched once the game is finished', () => {
    const { room, player } = makeRoom(now);
    room.status = 'finished';
    room.lastRoundEnd = { ...roundEnd(), round: 3, nextRoundIn: 0 };

    expect(toFullState(room, player, now + 5_000).lastRoundEnd?.nextRoundIn).toBe(0);
  });
});
