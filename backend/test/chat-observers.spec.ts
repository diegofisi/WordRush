import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import esWords from '@modules/words/data/es.json';
import type {
  ChatMessage,
  ClientToServerEvents,
  LobbyState,
  ServerToClientEvents,
} from '@shared/contract';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const ANSWER = esWords.answers[0];

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

/** Resolves true if the event arrives within `ms`, false otherwise. */
const arrives = (socket: Client, event: keyof ServerToClientEvents, ms = 300) =>
  waitFor(socket, event, ms).then(
    () => true,
    () => false,
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** docs/context/06-v1.1.md -> Chat and Observers, through the real socket server. */
describe('Chat and observers (socket.io integration)', () => {
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
      .useValue({ pick: () => ANSWER })
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

  it('seats late joiners as observers and opens the chat to those done with the round', async () => {
    const ana = await connect();
    const bruno = await connect();
    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        mode: 'normal',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 1,
        capacity: 3,
        hintEnabled: true,
      },
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.state.role).toBe('player');
    expect(created.state.lobby.observers).toEqual([]);
    const joined = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joined.ok) throw new Error(joined.message);

    // Talk in the lobby reaches everybody at once.
    const lobbyTalk = waitFor(bruno, 'chat:message');
    expect(
      await ana.emitWithAck('chat:send', { channel: 'all', text: '  hola   a todos ' }),
    ).toEqual({
      ok: true,
    });
    expect(await lobbyTalk).toMatchObject({
      name: 'Ana',
      text: 'hola a todos',
      round: 0,
      duringPlay: false,
    });

    const anaRound = waitFor(ana, 'round:start');
    await ana.emitWithAck('room:start');
    await anaRound;

    // --- observers: two at most, boards visible, a neutral finished `me` -----
    const carla = await connect();
    const observing = await carla.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Carla',
    });
    if (!observing.ok) throw new Error(observing.message);
    expect(observing.state.role).toBe('observer');
    expect(observing.state.round).toMatchObject({
      role: 'observer',
      me: { finished: true, rows: [] },
    });
    expect(observing.state.round?.players.map((p) => p.playerId).sort()).toEqual(
      [created.playerId, joined.playerId].sort(),
    );
    expect(observing.state.lobby.observers).toEqual([
      expect.objectContaining({ name: 'Carla', wantsSeat: false }),
    ]);
    const dana = await connect();
    const observing2 = await dana.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Dana',
    });
    expect(observing2).toMatchObject({ ok: true, state: { role: 'observer' } });
    const eve = await connect();
    expect(
      await eve.emitWithAck('room:join', { roomCode: created.roomCode, name: 'Eve' }),
    ).toMatchObject({
      ok: false,
      code: 'room_full',
    });

    // --- chat during the round ----------------------------------------------
    // Ana is still guessing: no talk for her, and nothing reaches her.
    expect(await ana.emitWithAck('chat:send', { channel: 'all', text: 'psst' })).toMatchObject({
      ok: false,
      code: 'chat_not_allowed',
    });
    const toDana = waitFor(dana, 'chat:message');
    const toAna = arrives(ana, 'chat:message');
    expect(
      await carla.emitWithAck('chat:send', { channel: 'all', text: 'vamos Bruno, marica' }),
    ).toEqual({
      ok: true,
    });
    const fromCarla: ChatMessage = await toDana;
    expect(fromCarla).toMatchObject({
      name: 'Carla',
      observer: true,
      text: 'vamos Bruno, ******',
      duringPlay: true,
      round: 1,
    });
    expect(await toAna).toBe(false);
    // One message per second.
    expect(await carla.emitWithAck('chat:send', { channel: 'all', text: 'otra' })).toMatchObject({
      ok: false,
      code: 'cooldown',
    });

    // Ana solves: she is done with the round, the hidden talk is hers to read now.
    const solve = await ana.emitWithAck('game:guess', { word: ANSWER });
    if (!solve.ok) throw new Error(solve.message);
    expect(solve.solved).toBe(true);
    const history = await ana.emitWithAck('chat:history');
    if (!history.ok) throw new Error(history.message);
    expect(history.messages.map((m) => m.text)).toEqual(['hola a todos', 'vamos Bruno, ******']);
    const brunoHistory = await bruno.emitWithAck('chat:history');
    if (!brunoHistory.ok) throw new Error(brunoHistory.message);
    expect(brunoHistory.messages.map((m) => m.text)).toEqual(['hola a todos']);

    // --- an observer asks for a seat ------------------------------------------
    const wish = waitFor(ana, 'lobby:update');
    expect(await carla.emitWithAck('observer:sit', { wants: true })).toEqual({ ok: true });
    expect((await wish).observers.find((o) => o.name === 'Carla')?.wantsSeat).toBe(true);
    expect(await ana.emitWithAck('observer:sit', { wants: true })).toMatchObject({
      ok: false,
      code: 'not_observer',
    });

    // Bruno solves too: the only round ends, the game is over.
    const gameEnd = waitFor(carla, 'game:end');
    const brunoSolve = await bruno.emitWithAck('game:guess', { word: ANSWER });
    if (!brunoSolve.ok) throw new Error(brunoSolve.message);
    await gameEnd;
    // Everybody, Bruno included, reads the whole round's talk once it is over.
    const afterHistory = await bruno.emitWithAck('chat:history');
    if (!afterHistory.ok) throw new Error(afterHistory.message);
    expect(afterHistory.messages).toHaveLength(2);

    // "Play again": Carla takes the free seat, Dana keeps observing, the chat starts afresh.
    const restarted = waitFor(dana, 'lobby:update');
    expect(await ana.emitWithAck('room:restart')).toEqual({ ok: true });
    const lobby: LobbyState = await restarted;
    expect(lobby.status).toBe('lobby');
    expect(lobby.players.map((p) => p.name)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(lobby.observers.map((o) => o.name)).toEqual(['Dana']);
    const fresh = await dana.emitWithAck('chat:history');
    if (!fresh.ok) throw new Error(fresh.message);
    expect(fresh.messages).toEqual([]);
    await sleep(0);
  });
});
