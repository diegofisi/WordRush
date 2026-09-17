import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { CorsIoAdapter, HEARTBEAT } from '@shared/socket/cors-io.adapter';
import type { ClientToServerEvents, LobbyState, ServerToClientEvents } from '@shared/contract';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

function waitFor<K extends keyof ServerToClientEvents>(
  socket: Client,
  event: K,
  timeoutMs = 6000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    (socket.once as (name: string, cb: (payload: unknown) => void) => void)(event, (payload) => {
      clearTimeout(timer);
      resolve(payload as Parameters<ServerToClientEvents[K]>[0]);
    });
  });
}

/**
 * docs/context/02-game-rules.md -> "Disconnections and room lifetime". A tunnel,
 * a locked screen or a background tab must not cost anybody their seat: the
 * server's heartbeat is patient and Socket.IO's connection state recovery brings
 * the same socket back to the same player.
 */
describe('Reconnection (socket.io integration)', () => {
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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // The production adapter: patient heartbeat plus connection state recovery.
    app.useWebSocketAdapter(new CorsIoAdapter(app, undefined));
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as Server;
    const { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await app.close();
  });

  it('waits two minutes for a pong instead of the twenty seconds of the default', () => {
    expect(HEARTBEAT.pingTimeout).toBe(120_000);
    expect(HEARTBEAT.pingInterval).toBe(20_000);
  });

  it('gives the same seat back to a socket that lost its transport', async () => {
    const ana = await connect();
    const bruno = await connect();

    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        game: 'wordle',
        mode: 'normal',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 1,
        capacity: 4,
        hintEnabled: true,
      },
    });
    if (!created.ok) throw new Error(created.message);
    // Bruno joining broadcasts a lobby:update, which is what gives Ana's client
    // the offset that connection state recovery resumes from.
    const joined = waitFor(ana, 'lobby:update');
    const joinedB = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joinedB.ok) throw new Error(joinedB.message);
    await joined;

    const idBefore = ana.id;
    const away = waitFor<'lobby:update'>(bruno, 'lobby:update');
    const back = new Promise<void>((resolve) => ana.once('connect', () => resolve()));
    // The tunnel drops: the transport closes under the client, without leaving.
    ana.io.engine.close();

    // The room hears Ana is away, and still lists her in her seat.
    const gone: LobbyState = await away;
    expect(gone.players.map((p) => [p.name, p.connected])).toEqual([
      ['Ana', false],
      ['Bruno', true],
    ]);

    await back;
    expect(ana.recovered).toBe(true);
    expect(ana.id).toBe(idBefore);

    // The seat came back with the socket: an event that needs a session works,
    // and it is still Ana's, with her host flag.
    expect(await ana.emitWithAck('room:ready', { ready: true })).toEqual({ ok: true });
    const lobby = await ana.emitWithAck('room:rejoin', {
      roomCode: created.roomCode,
      playerId: created.playerId,
      token: created.token,
    });
    if (!lobby.ok) throw new Error(lobby.message);
    expect(lobby.playerId).toBe(created.playerId);
    expect(lobby.state.lobby.players.map((p) => [p.name, p.connected, p.isHost])).toEqual([
      ['Ana', true, true],
      ['Bruno', true, false],
    ]);

    ana.disconnect();
    bruno.disconnect();
  }, 20000);
});
