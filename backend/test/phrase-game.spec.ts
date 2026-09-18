import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PHRASE_BANK } from '@modules/words/domain/interfaces/phrase-bank.interface';
import { PHRASE_RULES, SCORING } from '@shared/contract';
import type { ClientToServerEvents, RoundEndPayload, ServerToClientEvents } from '@shared/contract';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const PHRASE = 'más vale tarde que nunca';

function waitFor<K extends keyof ServerToClientEvents>(
  socket: Client,
  event: K,
  timeoutMs = 4000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    (socket.once as (name: string, cb: (payload: unknown) => void) => void)(event, (payload) => {
      clearTimeout(timer);
      resolve(payload as Parameters<ServerToClientEvents[K]>[0]);
    });
  });
}

/** docs/context/06-v1.1.md -> Guess the phrase, through the real socket server. */
describe('Guess the phrase (socket.io integration)', () => {
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
      .overrideProvider(PHRASE_BANK)
      .useValue({ pick: () => PHRASE })
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

  it('reveals letters from typed words, takes phrase sends, and scores the phrase', async () => {
    const ana = await connect();
    const bruno = await connect();
    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        game: 'phrase',
        mode: 'normal',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 1,
        capacity: 2,
        hintEnabled: true,
      },
    });
    if (!created.ok) throw new Error(created.message);
    const joined = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joined.ok) throw new Error(joined.message);

    // The layout is public from the first second; the letters are not.
    const anaRound = waitFor(ana, 'round:start');
    await ana.emitWithAck('room:start');
    const round = await anaRound;
    expect(round.game).toBe('phrase');
    expect(round.phraseWords).toEqual([3, 4, 5, 3, 5]);
    expect(round.maxAttempts).toBe(PHRASE_RULES.words);
    expect(round.hintAvailable).toBe(false);
    expect(round.me.phrase).toMatchObject({ found: 0, total: 20, sendsUsed: 0, completed: false });
    expect(round.me.phrase?.letters[0]).toEqual([null, null, null]);

    // No hint in this game.
    expect(await ana.emitWithAck('game:hint')).toMatchObject({
      ok: false,
      code: 'hint_unavailable',
    });

    // "canto": c, a, n, t are in the phrase (every occurrence revealed, 2 s each), o is not.
    const brunoSees = waitFor(bruno, 'player:progress');
    const word = await ana.emitWithAck('game:guess', { word: 'canto' });
    if (!word.ok) throw new Error(word.message);
    expect(word.colors).toEqual(['green', 'green', 'green', 'green', 'gray']);
    // a ×4, c ×1, n ×2, t ×1 -> 8 occurrences -> 16 s
    expect(word.secondsGained).toBe(8 * PHRASE_RULES.secondsPerOccurrence);
    expect(word.phrase).toMatchObject({ found: 8, total: 20, completed: false });
    expect(word.phrase?.letters[1]).toEqual([null, 'a', null, null]);
    // Bruno sees where Ana has letters, never which.
    const progress = await brunoSees;
    expect(progress.phrase?.mask[1]).toEqual([false, true, false, false]);
    expect(JSON.stringify(progress)).not.toContain('"a"');

    // A send that does not fit the words is refused; a miss spends one of five.
    expect(await ana.emitWithAck('game:phrase', { text: 'mas vale' })).toMatchObject({
      ok: false,
      code: 'phrase_shape',
    });
    const miss = await ana.emitWithAck('game:phrase', { text: 'mas vale tarde que nunco' });
    if (!miss.ok) throw new Error(miss.message);
    expect(miss).toMatchObject({ correct: false, sendsUsed: 1, finished: false });
    expect(miss.wrong?.[4]).toEqual([false, false, false, false, true]);

    // The hit: Ana is first, Bruno's clock takes the usual hit.
    const penalty = waitFor(bruno, 'time:penalty');
    const solved = waitFor(bruno, 'player:solved');
    const hit = await ana.emitWithAck('game:phrase', { text: 'MÁS vale tarde que nunca' });
    if (!hit.ok) throw new Error(hit.message);
    expect(hit).toMatchObject({ correct: true, finished: true, solvedPosition: 1, wrong: null });
    expect((await penalty).seconds).toBe(SCORING.penaltyOnRivalSolveSeconds);
    expect((await solved).playerId).toBe(created.playerId);

    // Bruno burns his five sends: his round ends without the phrase.
    const end = waitFor(ana, 'round:end');
    for (let i = 0; i < PHRASE_RULES.sends; i++) {
      const attempt = await bruno.emitWithAck('game:phrase', { text: 'mas vale tarde que nunco' });
      if (!attempt.ok) throw new Error(attempt.message);
      expect(attempt.finished).toBe(i === PHRASE_RULES.sends - 1);
    }
    const payload: RoundEndPayload = await end;
    expect(payload.game).toBe('phrase');
    expect(payload.phrase).toBe('mas vale tarde que nunca');
    const anaRow = payload.breakdown.find((row) => row.playerId === created.playerId)!;
    expect(anaRow).toMatchObject({
      solved: true,
      attempt: 1,
      position: 1,
      solveBonus: PHRASE_RULES.completeBonus,
      attemptPenalty: -PHRASE_RULES.wordPenalty,
      sendsFailed: 1,
      sendPenalty: -PHRASE_RULES.sendPenalty,
      positionBonus: SCORING.positionBonus[0],
      phrasePercent: 100,
    });
    expect(anaRow.roundPoints).toBe(
      Math.max(PHRASE_RULES.completeBonus, anaRow.timePoints + 80 - 4 - 5 + 20),
    );
    const brunoRow = payload.breakdown.find((row) => row.playerId === joined.playerId)!;
    expect(brunoRow).toMatchObject({
      solved: false,
      sendsFailed: 5,
      phrasePercent: 0,
      roundPoints: 0,
    });
  });

  /** 2026-09-17: four words a round, not six. The number lives in the contract. */
  it('gives each player exactly PHRASE_RULES.words words, and refuses one more', async () => {
    const ana = await connect();
    const bruno = await connect();
    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        game: 'phrase',
        mode: 'normal',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 1,
        capacity: 2,
        hintEnabled: true,
      },
    });
    if (!created.ok) throw new Error(created.message);
    const joined = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joined.ok) throw new Error(joined.message);

    const anaRound = waitFor(ana, 'round:start');
    await ana.emitWithAck('room:start');
    // The board is drawn from this: four rows, not six.
    expect((await anaRound).maxAttempts).toBe(PHRASE_RULES.words);

    for (let i = 0; i < PHRASE_RULES.words; i++) {
      const typed = await ana.emitWithAck('game:guess', { word: 'canto' });
      if (!typed.ok) throw new Error(typed.message);
      expect(typed.attempt).toBe(i + 1);
      // Running out of words ends nothing: the phrase, the sends or the clock do.
      expect(typed.finished).toBe(false);
    }
    expect(await ana.emitWithAck('game:guess', { word: 'canto' })).toMatchObject({
      ok: false,
      code: 'already_finished',
    });
    // Her sends are untouched by it.
    const send = await ana.emitWithAck('game:phrase', { text: 'mas vale tarde que nunca' });
    expect(send).toMatchObject({ ok: true, correct: true });
  });
});
