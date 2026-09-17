import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import esWords from '@modules/words/data/es.json';
import type {
  ClientToServerEvents,
  GameEndPayload,
  RoundEndPayload,
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

/**
 * docs/context/06-v1.1.md -> Teams: when every member of a team leaves the room
 * on purpose there is nobody to race, so the round is settled and the game ends.
 */
describe('Team mode: a whole team walks out (socket.io integration)', () => {
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

  it('settles the round and ends the game of three when team b leaves mid-round', async () => {
    const ana = await connect();
    const bruno = await connect();
    const carla = await connect();

    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        game: 'wordle',
        mode: 'teams',
        wordLength: 5,
        initialSeconds: 120,
        rounds: 3,
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
    // a = Ana + Bruno, b = Carla alone (the third seat lands on `a` by default).
    expect(await ana.emitWithAck('team:assign', { playerId: joinedC.playerId, team: 'b' })).toEqual(
      {
        ok: true,
      },
    );
    expect(await bruno.emitWithAck('team:join', { team: 'a' })).toEqual({ ok: true });

    const started = waitFor(ana, 'round:start');
    expect(await ana.emitWithAck('room:start')).toEqual({ ok: true });
    await started;

    // Ana solves for team a; Carla's team has nothing yet.
    const solved = await ana.emitWithAck('game:guess', { word: ANSWER });
    if (!solved.ok) throw new Error(solved.message);
    expect(solved.solved).toBe(true);

    // Carla, the whole of team b, walks out on purpose. Round 1 of 3 is the last.
    const roundEnd = waitFor<'round:end'>(ana, 'round:end');
    const gameEnd = waitFor<'game:end'>(ana, 'game:end');
    expect(await carla.emitWithAck('room:leave')).toEqual({ ok: true });

    const end: RoundEndPayload = await roundEnd;
    expect(end.round).toBe(1);
    expect(end.totalRounds).toBe(3);
    expect(end.nextRoundIn).toBe(0);
    const a = end.teams.find((t) => t.team === 'a')!;
    const b = end.teams.find((t) => t.team === 'b')!;
    expect(a.solved).toBe(true);
    expect(a.roundPoints).toBeGreaterThan(0);
    // The team that left never solved: an unsolved team scores nothing.
    expect(b.solved).toBe(false);
    expect(b.roundPoints).toBe(0);

    const final: GameEndPayload = await gameEnd;
    expect(final.teamStandings[0]).toMatchObject({ team: 'a', rank: 1, gamesWon: 1 });

    // The room is finished, so "play again" puts it back in the lobby.
    const lobby = waitFor(bruno, 'lobby:update');
    expect(await ana.emitWithAck('room:restart')).toEqual({ ok: true });
    expect((await lobby).status).toBe('lobby');

    ana.disconnect();
    bruno.disconnect();
    carla.disconnect();
  }, 20000);
});
