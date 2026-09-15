import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import esWords from '@modules/words/data/es.json';
import { BOSS, bossClockSeconds } from '@shared/contract';
import type {
  ClientToServerEvents,
  LobbyState,
  PenaltyPayload,
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

const SETTINGS = {
  language: 'es' as const,
  initialSeconds: 60,
  rounds: 1,
  capacity: 4,
  hintEnabled: true,
  bossMode: true,
};

/** docs/context/06-boss-mode.md, driven through the real socket server. */
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

  it('seats the fly, lets one human start, and plays her turns on her own', async () => {
    const ana = await connect();

    const created = await ana.emitWithAck('room:create', { name: 'Ana', settings: SETTINGS });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // The fly takes a seat as soon as the room is created in boss mode.
    const lobby: LobbyState = created.state.lobby;
    const bot = lobby.players.find((p) => p.isBot);
    expect(bot).toBeDefined();
    expect(bot!.isHost).toBe(false);
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

    // She guesses without anybody asking her to. A decision is about 7 s of
    // wall time on the one brain thread, and a fly from an earlier room may
    // still have one in flight when this one starts, so the wait is generous.
    const progress = await new Promise<{ playerId: string; attempt: number }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the fly never played')), 25000);
      ana.on('player:progress', (p) => {
        if (p.playerId === bot!.id && p.attempt > 0) {
          clearTimeout(timer);
          resolve(p);
        }
      });
    });
    expect(progress.attempt).toBeGreaterThan(0);

    ana.disconnect();
  }, 40000);

  it('streams live brain frames while the instrument is watching', async () => {
    const ana = await connect();

    const created = await ana.emitWithAck('room:create', { name: 'Ana', settings: SETTINGS });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const roundPromise = waitFor(ana, 'round:start');
    await ana.emitWithAck('room:start');
    await roundPromise;

    // Nobody is looking yet, so nothing should be simulated for the panel.
    const quiet = await Promise.race([
      waitFor(ana, 'boss:frame', 1200).then(() => 'frame' as const),
      new Promise<'silent'>((resolve) => setTimeout(() => resolve('silent'), 1200)),
    ]).catch(() => 'silent' as const);
    expect(quiet).toBe('silent');

    // The panel opens: frames start, and they carry every live column the
    // decision network draws, not just the descending rates.
    // The watch request queues behind whatever decision the thread is in.
    const framePromise = waitFor(ana, 'boss:frame', 25000);
    const watched = await ana.emitWithAck('boss:watch', { watching: true });
    expect(watched.ok).toBe(true);

    const first = await framePromise;
    expect(first.biologicalMs).toBeGreaterThan(0);
    expect(first.descending).toHaveLength(64);
    expect(first.letters).toHaveLength(27);
    expect(first.voltage).toHaveLength(26);
    expect(first.cloud.length).toBeGreaterThan(0);

    // Two slices in a row must differ: a frozen panel is the bug this covers.
    const second = await waitFor(ana, 'boss:frame', 25000);
    const moved =
      second.cloud !== first.cloud ||
      second.descending.some((hz, i) => hz !== first.descending[i]) ||
      second.letters.some((value, i) => value !== first.letters[i]);
    expect(moved).toBe(true);

    await ana.emitWithAck('boss:watch', { watching: false });
    ana.disconnect();
  }, 60000);

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

  it('scores her like any other player and still reports her on her own', async () => {
    const ana = await connect();

    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: { ...SETTINGS, hintEnabled: false },
    });
    if (!created.ok) throw new Error('room:create failed');

    // She is on the room's clock at the room's minimum, 60 s, and she thinks
    // for 9-20 s per guess: the round genuinely takes most of a minute to close
    // now that the real brain is driving her. That is the wall time, not a hang.
    // She earns time from new letters like anybody else and has ten attempts,
    // so her round on a 60 s clock runs anywhere from ~50 to ~90 s depending
    // on the words she draws. That spread is the game, not a hang.
    const endPromise = waitFor<'round:end'>(ana, 'round:end', 150000);
    await ana.emitWithAck('room:start');
    // Ana solves immediately; the fly then has to beat a clock she cannot heal.
    await ana.emitWithAck('game:guess', { word: ANSWER });

    const end: RoundEndPayload = await endPromise;
    expect(typeof end.bossDefeated).toBe('boolean');

    // She plays on the room's clock, so she is measured by the same formula and
    // sits in both tables like anybody else.
    expect(end.breakdown).toHaveLength(2);
    expect(end.standings).toHaveLength(2);
    const botRow = end.breakdown.find((row) => row.playerId !== created.playerId)!;
    expect(botRow.name).toBe('Mosca');
    // The team bonus is still the team's; the opponent never collects it.
    expect(botRow.bossBonus).toBe(0);

    // Her result also travels on its own summary, with the words she played.
    expect(end.boss).not.toBeNull();
    expect(end.boss!.attempts).toBeGreaterThan(0);
    expect(end.boss!.rows).toHaveLength(end.boss!.attempts);
    expect(end.boss!.solved).toBe(end.bossDefeated === false);
    expect(end.boss!.defeated).toBe(end.bossDefeated);

    const anaRow = end.breakdown.find((row) => row.playerId === created.playerId)!;
    expect(anaRow.bossBonus).toBe(end.bossDefeated ? BOSS.defeatedBonus : 0);
    expect(anaRow.solved).toBe(true);

    // She never sends the same word twice, and every word she sends is still
    // possible given her own colours. Both were broken: an empty candidate list
    // silently fell back to the whole pool, so she replayed one word for three
    // attempts in a row while the answer was already the only thing left.
    const words = end.boss!.rows.map((row) => row.word);
    expect(new Set(words).size).toBe(words.length);
    for (let i = 1; i < end.boss!.rows.length; i += 1) {
      const played = end.boss!.rows[i].word;
      for (let j = 0; j < i; j += 1) {
        const earlier = end.boss!.rows[j];
        // A probe may be impossible as an answer, but it must never contradict
        // a grey: a letter she has seen is absent cannot come back.
        for (let k = 0; k < earlier.colors.length; k += 1) {
          if (earlier.colors[k] !== 'gray') continue;
          const dead = earlier.word[k];
          const alsoElsewhere = earlier.word
            .split('')
            .some((letter, at) => letter === dead && earlier.colors[at] !== 'gray');
          if (!alsoElsewhere) expect(played).not.toContain(dead);
        }
      }
    }

    ana.disconnect();
  }, 170000);
});
