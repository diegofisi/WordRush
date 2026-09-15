import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import esWords from '@modules/words/data/es.json';
import es6Words from '@modules/words/data/es6.json';
import { ROOM_LIMITS } from '@shared/contract';
import type {
  ClientToServerEvents,
  GameEndPayload,
  PenaltyPayload,
  RoundEndPayload,
  RoundState,
  ServerToClientEvents,
  SolvedPayload,
} from '@shared/contract';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const ANSWER = esWords.answers[0];
const WRONG = esWords.answers.find((w) => w !== ANSWER && w[0] !== ANSWER[0])!;
const ANSWER6 = es6Words.answers[0];
const WRONG6 = es6Words.answers.find((w) => w !== ANSWER6 && w[0] !== ANSWER6[0])!;

function waitFor<K extends keyof ServerToClientEvents>(
  socket: Client,
  event: K,
  timeoutMs = 4000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    // Socket.IO's typed `once` cannot express a generic listener; cast once here.
    (socket.once as (name: string, cb: (payload: unknown) => void) => void)(event, (payload) => {
      clearTimeout(timer);
      resolve(payload as Parameters<ServerToClientEvents[K]>[0]);
    });
  });
}

describe('WordRush game flow (socket.io integration)', () => {
  let app: INestApplication;
  let url: string;
  const clients: Client[] = [];

  const connect = async (): Promise<Client> => {
    const socket: Client = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    return socket;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WORD_PICKER)
      .useValue({ pick: (_language: string, length: number) => (length === 6 ? ANSWER6 : ANSWER) })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    const { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await app.close();
  });

  it('plays a full one-round game between two players', async () => {
    const ana = await connect();
    const bruno = await connect();

    // --- lobby ---------------------------------------------------------
    const created = await ana.emitWithAck('room:create', {
      name: '  Ana ',
      settings: {
        language: 'es',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 1,
        capacity: 4,
        hintEnabled: true,
      },
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(created.state.lobby.players).toEqual([
      expect.objectContaining({ id: created.playerId, name: 'Ana', isHost: true }),
    ]);
    expect(created.state.round).toBeNull();

    const lobbyUpdate = waitFor(ana, 'lobby:update');
    const joined = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joined.ok) throw new Error(joined.message);
    expect((await lobbyUpdate).players.map((p) => p.name)).toEqual(['Ana', 'Bruno']);

    const dup = await connect().then((c) =>
      c.emitWithAck('room:join', { roomCode: created.roomCode, name: 'bruno' }),
    );
    expect(dup).toEqual({ ok: false, code: 'name_taken', message: expect.any(String) });
    const missing = await connect().then((c) =>
      c.emitWithAck('room:join', { roomCode: 'ZZZZ', name: 'X' }),
    );
    expect(missing).toMatchObject({ ok: false, code: 'room_not_found' });
    // One game at a time: Ana already holds a seat, so she cannot join or create another.
    const second = await ana.emitWithAck('room:join', { roomCode: 'ZZZZ', name: 'X' });
    expect(second).toMatchObject({ ok: false, code: 'already_in_room' });
    // The refused join must not have kicked her out of her room.
    const early = await ana.emitWithAck('game:guess', { word: ANSWER });
    expect(early).toMatchObject({ ok: false, code: 'not_in_round' });

    const invalid = await ana.emitWithAck('room:create', { name: 'x', settings: {} } as never);
    expect(invalid).toMatchObject({ ok: false, code: 'invalid_payload' });

    // Bruno reloads: a new socket rejoins with his credentials.
    const bruno2 = await connect();
    const rejoined = await bruno2.emitWithAck('room:rejoin', {
      roomCode: created.roomCode,
      playerId: joined.playerId,
      token: joined.token,
    });
    if (!rejoined.ok) throw new Error(rejoined.message);
    expect(rejoined.state.lobby.players).toHaveLength(2);
    const badToken = await ana.emitWithAck('room:rejoin', {
      roomCode: created.roomCode,
      playerId: joined.playerId,
      token: 'nope',
    });
    expect(badToken).toMatchObject({ ok: false, code: 'session_expired' });

    const notHost = await bruno2.emitWithAck('room:start');
    expect(notHost).toMatchObject({ ok: false, code: 'not_host' });

    // --- round ---------------------------------------------------------
    const anaRound = waitFor(ana, 'round:start');
    const brunoRound = waitFor(bruno2, 'round:start');
    const started = await ana.emitWithAck('room:start');
    expect(started).toEqual({ ok: true });
    const [rsA, rsB]: RoundState[] = await Promise.all([anaRound, brunoRound]);
    expect(rsA.round).toBe(1);
    expect(rsA.totalRounds).toBe(1);
    expect(rsA.me.rows).toEqual([]);
    expect(rsA.players.map((p) => p.playerId).sort()).toEqual(
      [created.playerId, joined.playerId].sort(),
    );
    expect(rsB.me.secondsLeft).toBeGreaterThan(55);

    // Bruno uses his hint.
    const hintSeen = waitFor(ana, 'player:hint');
    const hint = await bruno2.emitWithAck('game:hint');
    if (!hint.ok) throw new Error(hint.message);
    // The ack carries the letter only; the position never leaves the server.
    expect(ANSWER).toContain(hint.letter);
    // Some slot is still unknown, so the hint is a letter and the slot stays unsaid.
    expect(hint.kind).toBe('letter');
    expect(hint.position).toBeNull();
    // Anonymous: the room learns that a hint was spent, not by whom.
    expect(await hintSeen).toEqual({ usedInRound: 1 });
    const again = await bruno2.emitWithAck('game:hint');
    expect(again).toMatchObject({ ok: false, code: 'hint_already_used' });

    // Ana: one wrong guess, then the answer.
    const brunoSeesProgress = waitFor(bruno2, 'player:progress');
    const wrong = await ana.emitWithAck('game:guess', { word: WRONG.toUpperCase() });
    if (!wrong.ok) throw new Error(wrong.message);
    expect(wrong.colors).toHaveLength(5);
    expect(wrong.attempt).toBe(1);
    expect(wrong.solved).toBe(false);
    const progress = await brunoSeesProgress;
    expect(progress.playerId).toBe(created.playerId);
    expect(progress.rows).toEqual([wrong.colors]);
    expect(JSON.stringify(progress)).not.toContain(WRONG);

    const notAWord = await ana.emitWithAck('game:guess', { word: 'zzzzz' });
    expect(notAWord).toMatchObject({ ok: false, code: 'word_not_in_list' });

    const solvedSeen = waitFor(bruno2, 'player:solved');
    const penaltySeen = waitFor(bruno2, 'time:penalty');
    const solve = await ana.emitWithAck('game:guess', { word: ANSWER });
    if (!solve.ok) throw new Error(solve.message);
    expect(solve.solved).toBe(true);
    expect(solve.finished).toBe(true);
    expect(solve.solvedPosition).toBe(1);
    expect(solve.attempt).toBe(2);
    expect(solve.colors).toEqual(['green', 'green', 'green', 'green', 'green']);

    const solvedPayload: SolvedPayload = await solvedSeen;
    expect(solvedPayload).toEqual({
      playerId: created.playerId,
      position: 1,
      attempt: 2,
      secondsLeft: solve.secondsLeft,
    });
    const penalty: PenaltyPayload = await penaltySeen;
    expect(penalty.fromPlayerId).toBe(created.playerId);
    expect(penalty.seconds).toBe(5);
    expect(penalty.clocks).toHaveLength(1);
    expect(penalty.clocks[0].playerId).toBe(joined.playerId);
    expect(penalty.clocks[0].secondsLeft).toBeLessThanOrEqual(55);
    expect(penalty.clocks[0].secondsLeft).toBeGreaterThan(50);

    const afterFinish = await ana.emitWithAck('game:guess', { word: ANSWER });
    expect(afterFinish).toMatchObject({ ok: false, code: 'already_finished' });

    // Bruno solves second -> round ends -> game ends (1 round).
    const roundEndA = waitFor(ana, 'round:end');
    const roundEndB = waitFor(bruno2, 'round:end');
    const gameEndA = waitFor(ana, 'game:end');
    const brunoSolve = await bruno2.emitWithAck('game:guess', { word: ANSWER });
    if (!brunoSolve.ok) throw new Error(brunoSolve.message);
    expect(brunoSolve.solvedPosition).toBe(2);
    expect(brunoSolve.secondsGained).toBe(45); // 4 direct greens + 1 green after hint

    const [endA, endB]: RoundEndPayload[] = await Promise.all([roundEndA, roundEndB]);
    expect(endB).toEqual(endA);
    expect(endA.word).toBe(ANSWER);
    expect(endA.round).toBe(1);
    expect(endA.nextRoundIn).toBe(0);

    const anaLine = endA.breakdown.find((b) => b.playerId === created.playerId)!;
    expect(anaLine).toMatchObject({
      name: 'Ana',
      solved: true,
      attempt: 2,
      position: 1,
      solveBonus: 40,
      attemptPenalty: -2,
      positionBonus: 20,
      hintBonus: 10,
      greens: 5,
      greenPoints: 0,
      yellows: 0,
      yellowPoints: 0,
    });
    expect(anaLine.timePoints).toBe(Math.round((solve.secondsLeft / 60) * 100));
    expect(anaLine.roundPoints).toBe(anaLine.timePoints + 40 - 2 + 20 + 10);

    const brunoLine = endA.breakdown.find((b) => b.playerId === joined.playerId)!;
    expect(brunoLine).toMatchObject({
      solved: true,
      attempt: 1,
      position: 2,
      solveBonus: 40,
      attemptPenalty: 0,
      positionBonus: 15,
      hintBonus: 0,
    });
    expect(brunoLine.roundPoints).toBe(brunoLine.timePoints + 40 + 15);

    expect(endA.standings).toHaveLength(2);
    expect(endA.standings.map((s) => s.rank)).toEqual([1, 2]);
    for (const s of endA.standings) {
      const line = endA.breakdown.find((b) => b.playerId === s.playerId)!;
      expect(s.total).toBe(line.roundPoints);
      expect(s.attempts).toBe(line.attempt);
    }
    expect(endA.standings.find((s) => s.playerId === joined.playerId)!.hintsUsed).toBe(1);

    const gameEnd: GameEndPayload = await gameEndA;
    expect(gameEnd.rounds).toBe(1);
    expect(gameEnd.standings).toEqual(endA.standings);

    // --- after the game ------------------------------------------------
    const late = await ana.emitWithAck('game:guess', { word: ANSWER });
    expect(late).toMatchObject({ ok: false, code: 'not_in_round' });

    const reactionSeen = waitFor(bruno2, 'reaction:show');
    expect(await ana.emitWithAck('reaction:send', { emote: 'lol' })).toEqual({ ok: true });
    expect(await reactionSeen).toEqual({ playerId: created.playerId, emote: 'lol' });
    // No per-emote cooldown any more: the burst limit is what stops a spammer.
    for (let i = 1; i < ROOM_LIMITS.emoteBurstLimit; i++) {
      expect(await ana.emitWithAck('reaction:send', { emote: 'gg' })).toEqual({ ok: true });
    }
    expect(await ana.emitWithAck('reaction:send', { emote: 'shh' })).toMatchObject({
      ok: false,
      code: 'cooldown',
    });

    const health = await fetch(`${url}/health`).then((r) => r.json());
    expect(health).toEqual({ status: 'ok', rooms: 1 });

    expect(await ana.emitWithAck('room:leave')).toEqual({ ok: true });
    expect(await bruno2.emitWithAck('room:leave')).toEqual({ ok: true });
    const emptied = await fetch(`${url}/health`).then((r) => r.json());
    expect(emptied).toEqual({ status: 'ok', rooms: 0 });
  });

  it('plays a round of six letters with nine attempts', async () => {
    const ana = await connect();
    const bruno = await connect();
    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        wordLength: 6,
        initialSeconds: 60,
        rounds: 1,
        capacity: 4,
        hintEnabled: false,
      },
    });
    if (!created.ok) throw new Error(created.message);
    const joined = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joined.ok) throw new Error(joined.message);

    const roundStart = waitFor(ana, 'round:start');
    await ana.emitWithAck('room:start');
    const round: RoundState = await roundStart;
    expect(round.wordLength).toBe(6);
    expect(round.maxAttempts).toBe(9);

    // A five-letter word is the wrong shape here, whatever the list says.
    expect(await ana.emitWithAck('game:guess', { word: ANSWER })).toMatchObject({
      ok: false,
      code: 'word_length',
    });
    const miss = await ana.emitWithAck('game:guess', { word: WRONG6 });
    if (!miss.ok) throw new Error(miss.message);
    expect(miss.colors).toHaveLength(6);
    expect(miss.solved).toBe(false);
    const hit = await ana.emitWithAck('game:guess', { word: ANSWER6 });
    if (!hit.ok) throw new Error(hit.message);
    expect(hit.solved).toBe(true);
    expect(hit.attempt).toBe(2);

    ana.disconnect();
    bruno.disconnect();
  });

  it('throttles room creation per socket, spending the budget on failed attempts too', async () => {
    const settings = {
      language: 'es' as const,
      wordLength: 5 as const,
      initialSeconds: 60,
      rounds: 1,
      capacity: 2,
      hintEnabled: true,
    };
    const flood = await connect();

    const first = await flood.emitWithAck('room:create', { name: 'Flood', settings });
    expect(first.ok).toBe(true);

    // Attempts 2..5 bounce off the "one game at a time" rule, but they still
    // spend the flood budget: a script must not earn free retries by failing.
    for (let i = 2; i <= 5; i++) {
      expect(await flood.emitWithAck('room:create', { name: 'Flood', settings })).toMatchObject({
        ok: false,
        code: 'already_in_room',
      });
    }

    expect(await flood.emitWithAck('room:create', { name: 'Flood', settings })).toMatchObject({
      ok: false,
      code: 'cooldown',
    });

    expect(await flood.emitWithAck('room:leave')).toEqual({ ok: true });
  });
});
