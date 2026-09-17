import { type Clock } from '@shared/domain/clock';
import { DomainException } from '@shared/domain/domain.exception';
import { type OutboundEvent, RoomEventsBus } from '@shared/events/room-events.bus';
import { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { Player } from '@modules/rooms/domain/entities/player.entity';
import { Room } from '@modules/rooms/domain/entities/room.entity';
import { InMemoryRoomRepository } from '@modules/rooms/infrastructure/repositories/in-memory-room.repository';
import { type IWordList } from '@modules/words/domain/interfaces/word-list.interface';
import { RoundLifecycleService } from '../services/round-lifecycle.service';
import { RoundSchedulerService } from '../services/round-scheduler.service';
import { EndRoundUseCase } from './end-round.use-case';
import { StartRoundUseCase } from './start-round.use-case';
import { SubmitGuessUseCase } from './submit-guess.use-case';

const ANSWER = 'solid';
const T0 = 1_000_000;

class FakeClock implements Clock {
  current = T0;
  now(): number {
    return this.current;
  }
}

function makePlayer(id: string, now: number): Player {
  const p = Player.create({ id, token: `t-${id}`, name: id, isHost: id === 'a', joinedAt: now });
  p.round = new PlayerRound(now, 60, 5);
  return p;
}

describe('SubmitGuessUseCase', () => {
  let rooms: InMemoryRoomRepository;
  let clock: FakeClock;
  let bus: RoomEventsBus;
  let events: OutboundEvent[];
  let room: Room;
  let useCase: SubmitGuessUseCase;
  let scheduler: RoundSchedulerService;

  beforeEach(() => {
    rooms = new InMemoryRoomRepository();
    clock = new FakeClock();
    bus = new RoomEventsBus();
    events = [];
    bus.subscribe((e) => events.push(e));

    // BOSS-MODE (temporary; see docs/context/07-boss-removal.md): `guessable`.
    const wordList: IWordList = {
      isAllowed: () => true,
      answers: () => [ANSWER],
      guessable: () => [ANSWER],
    };
    scheduler = new RoundSchedulerService();
    const startRound = new StartRoundUseCase(
      { pick: () => ANSWER },
      { pick: () => 'mas vale tarde que nunca' },
      bus,
    );
    const endRound = new EndRoundUseCase(rooms, clock, bus, scheduler, startRound);
    const lifecycle = new RoundLifecycleService(bus, endRound);
    useCase = new SubmitGuessUseCase(rooms, wordList, clock, lifecycle);

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
    room.status = 'playing';
    room.word = ANSWER;
    room.currentRound = 1;
    room.roundStartedAt = T0;
    for (const id of ['a', 'b', 'c', 'd']) room.addPlayer(makePlayer(id, T0));
    rooms.save(room);
  });

  afterEach(() => scheduler.onModuleDestroy());

  const roundOf = (id: string) => room.findPlayer(id)!.round!;
  const eventsNamed = <K extends OutboundEvent['event']>(name: K) =>
    events.filter((e): e is Extract<OutboundEvent, { event: K }> => e.event === name);

  it('penalises only players that are still unsolved and not finished', () => {
    // c solved earlier, d ran out of attempts, b is still playing.
    roundOf('c').markSolved(1, T0);
    room.solvedCount = 1;
    roundOf('d').finish('attempts', T0);
    const bDeadline = roundOf('b').deadlineAt;
    const cDeadline = roundOf('c').deadlineAt;
    const dDeadline = roundOf('d').deadlineAt;

    clock.current = T0 + 10_000;
    const ack = useCase.execute('ABCD', 'a', ANSWER);

    expect(ack.solved).toBe(true);
    expect(ack.solvedPosition).toBe(2);
    expect(roundOf('b').deadlineAt).toBe(bDeadline - 5_000);
    expect(roundOf('b').penaltySeconds).toBe(5);
    expect(roundOf('c').deadlineAt).toBe(cDeadline);
    expect(roundOf('d').deadlineAt).toBe(dDeadline);
    expect(roundOf('a').frozenSecondsLeft).toBe(100); // 50 s left + 50 s of letters

    const penalties = eventsNamed('time:penalty');
    expect(penalties).toHaveLength(1);
    expect(penalties[0].payload.fromPlayerId).toBe('a');
    expect(penalties[0].payload.seconds).toBe(5);
    expect(penalties[0].payload.clocks.map((c) => c.playerId)).toEqual(['b']);
    expect(penalties[0].payload.clocks[0].secondsLeft).toBe(45);
  });

  it('assigns solve positions in processing order and freezes the solver clock', () => {
    const first = useCase.execute('ABCD', 'a', ANSWER);
    const second = useCase.execute('ABCD', 'b', ANSWER);
    expect(first.solvedPosition).toBe(1);
    expect(second.solvedPosition).toBe(2);
    expect(eventsNamed('player:solved').map((e) => e.payload.position)).toEqual([1, 2]);
    // The second solve did not touch the first solver's frozen clock.
    expect(roundOf('a').frozenSecondsLeft).toBe(110);
  });

  it('returns the colour feedback and gains, and broadcasts colours only', () => {
    const ack = useCase.execute('ABCD', 'a', 'sandy');
    expect(ack.colors).toEqual(['green', 'gray', 'gray', 'yellow', 'gray']);
    expect(ack.secondsGained).toBe(15);
    expect(ack.attempt).toBe(1);
    expect(ack.solved).toBe(false);
    const progress = eventsNamed('player:progress');
    expect(progress).toHaveLength(1);
    expect(progress[0].payload.rows).toEqual([['green', 'gray', 'gray', 'yellow', 'gray']]);
    expect(JSON.stringify(progress[0].payload)).not.toContain('sandy');
  });

  it('rejects malformed and unknown words and guesses after finishing', () => {
    expect(() => useCase.execute('ABCD', 'a', 'sol')).toThrow(new DomainException('word_length'));
    useCase.execute('ABCD', 'a', ANSWER);
    expect(() => useCase.execute('ABCD', 'a', ANSWER)).toThrow(
      new DomainException('already_finished'),
    );
  });

  it('ends the round with a breakdown once every player is finished', () => {
    for (const id of ['a', 'b', 'c', 'd']) useCase.execute('ABCD', id, ANSWER);
    const ends = eventsNamed('round:end');
    expect(ends).toHaveLength(1);
    expect(ends[0].payload.word).toBe(ANSWER);
    expect(ends[0].payload.nextRoundIn).toBe(12);
    expect(ends[0].payload.breakdown.map((b) => b.position)).toEqual([1, 2, 3, 4]);
    expect(room.status).toBe('between-rounds');
  });
});
