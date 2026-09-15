import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import esWords from '@modules/words/data/es.json';
import { ROOM_LIMITS } from '@shared/contract';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/contract';

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

/** docs/context/06-v1.1.md -> Room management: kick, rejoin block, boards on results. */
describe('Room management (socket.io integration)', () => {
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

  it('lets the host kick, blocks the name for a while, and ships every board at round end', async () => {
    const ana = await connect();
    const bruno = await connect();
    const carla = await connect();
    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        mode: 'normal',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 1,
        capacity: 4,
        hintEnabled: true,
      },
    });
    if (!created.ok) throw new Error(created.message);
    const joinedB = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joinedB.ok) throw new Error(joinedB.message);
    const joinedC = await carla.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Carla',
    });
    if (!joinedC.ok) throw new Error(joinedC.message);

    // Only the host kicks, and never themselves.
    expect(await bruno.emitWithAck('room:kick', { playerId: created.playerId })).toMatchObject({
      ok: false,
      code: 'not_host',
    });
    expect(await ana.emitWithAck('room:kick', { playerId: created.playerId })).toMatchObject({
      ok: false,
      code: 'invalid_payload',
    });

    // Carla is told, then gone; the room hears she left.
    const kicked = waitFor(carla, 'room:kicked');
    const left = waitFor(bruno, 'player:left');
    expect(await ana.emitWithAck('room:kick', { playerId: joinedC.playerId })).toEqual({
      ok: true,
    });
    expect(await kicked).toEqual({
      roomCode: created.roomCode,
      rejoinAfterSeconds: ROOM_LIMITS.kickRejoinSeconds,
    });
    expect(await left).toMatchObject({ playerId: joinedC.playerId, name: 'Carla' });
    // Her socket lost its seat: room actions answer as a stranger's would.
    expect(await carla.emitWithAck('room:ready', { ready: true })).toMatchObject({
      ok: false,
      code: 'not_in_room',
    });
    // Her token is dead and her name is blocked for now (case-insensitive).
    expect(
      await carla.emitWithAck('room:rejoin', {
        roomCode: created.roomCode,
        playerId: joinedC.playerId,
        token: joinedC.token,
      }),
    ).toMatchObject({ ok: false, code: 'session_expired' });
    expect(
      await carla.emitWithAck('room:join', { roomCode: created.roomCode, name: 'carla' }),
    ).toMatchObject({
      ok: false,
      code: 'kicked',
    });
    // Another name walks straight in.
    const back = await carla.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Carla2',
    });
    expect(back).toMatchObject({ ok: true });

    // Round end carries every seated player's board with its letters.
    const anaRound = waitFor(ana, 'round:start');
    await ana.emitWithAck('room:start');
    await anaRound;
    const end = waitFor(ana, 'round:end');
    const solve = await ana.emitWithAck('game:guess', { word: ANSWER });
    if (!solve.ok) throw new Error(solve.message);
    // Bruno and Carla2 stop playing so the round closes: the host kicks them out
    // of the round by leaving? No: they simply run out through the host's kick of
    // Bruno and Carla2 leaving.
    await carla.emitWithAck('room:leave');
    expect(await ana.emitWithAck('room:kick', { playerId: joinedB.playerId })).toEqual({
      ok: true,
    });
    const payload = await end;
    expect(payload.boards.map((b) => b.name)).toEqual(['Ana']);
    expect(payload.boards[0]).toMatchObject({
      solved: true,
      rows: [{ word: ANSWER, colors: Array<'green'>(5).fill('green') }],
    });
  });
});
