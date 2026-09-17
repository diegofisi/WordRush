import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import esWords from '@modules/words/data/es.json';
import { BOSS, bossClockSeconds, DEFAULT_WORD_LENGTH } from '@shared/contract';
import type {
  ClientToServerEvents,
  LobbyState,
  PenaltyPayload,
  RoomSettings,
  RoundEndPayload,
  RoundState,
  ServerToClientEvents,
} from '@shared/contract';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const ANSWER = esWords.answers[0];

function waitFor<K extends keyof ServerToClientEvents>(
  socket: Client,
  event: K,
  timeoutMs = 8000,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    (socket.once as (name: string, cb: (payload: unknown) => void) => void)(event, (payload) => {
      clearTimeout(timer);
      resolve(payload as Parameters<ServerToClientEvents[K]>[0]);
    });
  });
}

const SETTINGS: RoomSettings = {
  language: 'es',
  game: 'wordle',
  mode: 'normal',
  wordLength: DEFAULT_WORD_LENGTH,
  initialSeconds: 60,
  rounds: 1,
  capacity: 4,
  hintEnabled: true,
  bossMode: true,
};

/**
 * docs/context/08-boss-mode.md, driven through the real socket server.
 *
 * What is asserted is the part the rest of the game shares with her: the seat,
 * the inverted attack and how the round is reported. Nothing asserts what she
 * plays — that is the brain's, it varies by round, and measuring it is the job
 * of `tools/boss-brain-control.spec.ts` and of a playtest.
 *
 * The last test does run the real brain (a decision is ~7 s of a core and a
 * 90 MB connectome per thread), which is why it is the slow one.
 */
describe('Boss mode (socket.io integration)', () => {
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

  it('seats the fly beside the humans and lets one of them start alone', async () => {
    const ana = await connect();

    const created = await ana.emitWithAck('room:create', { name: 'Ana', settings: SETTINGS });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // The fly takes a seat as soon as the room is created in boss mode.
    const lobby: LobbyState = created.state.lobby;
    const bot = lobby.players.find((p) => p.isBot);
    expect(bot).toBeDefined();
    expect(bot!.isHost).toBe(false);
    expect(bot!.name).toBe(BOSS.name);
    expect(lobby.players.filter((p) => !p.isBot)).toHaveLength(1);

    // A solo run is allowed: the opponent is already there.
    const roundPromise = waitFor(ana, 'round:start');
    const started = await ana.emitWithAck('room:start');
    expect(started.ok).toBe(true);

    const round: RoundState = await roundPromise;
    expect(round.boss).not.toBeNull();
    expect(round.boss!.playerId).toBe(bot!.id);
    expect(round.boss!.startSeconds).toBe(bossClockSeconds(SETTINGS.initialSeconds));
    expect(round.boss!.damageSeconds).toBe(0);
    expect(round.boss!.attempt).toBe(0);

    ana.disconnect();
  }, 20000);

  it('refuses to seat her in a game she cannot play', async () => {
    const ana = await connect();

    // Her brain is wired for a five-letter board (docs/context/08-boss-mode.md).
    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: { ...SETTINGS, wordLength: 7 },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.state.lobby.players.some((p) => p.isBot)).toBe(false);
    expect(created.state.lobby.settings.bossMode).toBe(false);

    ana.disconnect();
  }, 20000);

  it('sends a human solve at the fly and never at a teammate', async () => {
    const ana = await connect();
    const bruno = await connect();

    const created = await ana.emitWithAck('room:create', { name: 'Ana', settings: SETTINGS });
    if (!created.ok) throw new Error('room:create failed');
    const joined = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joined.ok) throw new Error('room:join failed');

    const brunoRound = waitFor(bruno, 'round:start');
    await ana.emitWithAck('room:start');
    const round: RoundState = await brunoRound;
    const botId = round.boss!.playerId;

    const penaltyPromise = waitFor<'time:penalty'>(bruno, 'time:penalty');
    const guess = await ana.emitWithAck('game:guess', { word: ANSWER });
    expect(guess.ok).toBe(true);
    if (guess.ok) expect(guess.solved).toBe(true);

    const penalty: PenaltyPayload = await penaltyPromise;
    expect(penalty.fromPlayerId).toBe(created.playerId);
    expect(penalty.seconds).toBe(BOSS.damageOnHumanSolve);
    // Only the fly is on the receiving end; Bruno is a teammate.
    expect(penalty.clocks.map((c) => c.playerId)).toEqual([botId]);

    ana.disconnect();
    bruno.disconnect();
  }, 20000);

  it('reports the fly on her own and pays the team bonus only when she goes down', async () => {
    const ana = await connect();

    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      // The shortest round the rules allow, so it closes without a long wait.
      settings: { ...SETTINGS, initialSeconds: 60, hintEnabled: false },
    });
    if (!created.ok) throw new Error('room:create failed');

    const endPromise = waitFor<'round:end'>(ana, 'round:end', 90000);
    await ana.emitWithAck('room:start');
    await ana.emitWithAck('game:guess', { word: ANSWER });

    const end: RoundEndPayload = await endPromise;
    // Whether she solves is the brain's business and varies by round; what is
    // asserted is that the round agrees with itself about it.
    expect(typeof end.bossDefeated).toBe('boolean');

    // She is on the room's clock, so she is measured by the same formula and
    // sits in both tables like anybody else.
    expect(end.breakdown).toHaveLength(2);
    expect(end.standings).toHaveLength(2);
    const botRow = end.breakdown.find((row) => row.playerId !== created.playerId)!;
    expect(botRow.name).toBe(BOSS.name);
    // The team bonus is the team's; the opponent never collects it.
    expect(botRow.bossBonus).toBe(0);

    const anaRow = end.breakdown.find((row) => row.playerId === created.playerId)!;
    expect(anaRow.solved).toBe(true);
    expect(anaRow.bossBonus).toBe(end.bossDefeated ? BOSS.defeatedBonus : 0);

    // Her result also travels on its own summary, with the words she played.
    expect(end.boss).not.toBeNull();
    expect(end.boss!.solved).toBe(end.bossDefeated === false);
    expect(end.boss!.defeated).toBe(end.bossDefeated);
    expect(end.boss!.rows).toHaveLength(end.boss!.attempts);
    // She never sends the same word twice.
    const words = end.boss!.rows.map((row) => row.word);
    expect(new Set(words).size).toBe(words.length);

    ana.disconnect();
  }, 100000);
});
