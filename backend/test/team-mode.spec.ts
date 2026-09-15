import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { WORD_PICKER } from '@modules/words/domain/interfaces/word-picker.interface';
import esWords from '@modules/words/data/es.json';
import { SCORING } from '@shared/contract';
import type {
  ClientToServerEvents,
  PenaltyPayload,
  RoundEndPayload,
  RoundState,
  ServerToClientEvents,
} from '@shared/contract';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const ANSWER = esWords.answers[0];
const WRONG = esWords.answers.find((w) => w !== ANSWER && w[0] !== ANSWER[0])!;

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

/** docs/context/06-v1.1.md -> Teams, driven through the real socket server. */
describe('Team mode (socket.io integration)', () => {
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

  it('seats two teams, shares one clock and one hint, and scores per team', async () => {
    const ana = await connect();
    const bruno = await connect();
    const carla = await connect();

    // --- lobby: seats are handed to the smaller team, then moved ---------
    const created = await ana.emitWithAck('room:create', {
      name: 'Ana',
      settings: {
        language: 'es',
        mode: 'teams',
        wordLength: 5,
        initialSeconds: 60,
        rounds: 1,
        capacity: 4,
        hintEnabled: true,
      },
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.state.lobby.teams.map((t) => t.id)).toEqual(['a', 'b']);
    expect(created.state.lobby.players[0].team).toBe('a');

    const joinedB = await bruno.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Bruno',
    });
    if (!joinedB.ok) throw new Error(joinedB.message);
    expect(joinedB.state.lobby.players.find((p) => p.name === 'Bruno')?.team).toBe('b');
    const joinedC = await carla.emitWithAck('room:join', {
      roomCode: created.roomCode,
      name: 'Carla',
    });
    if (!joinedC.ok) throw new Error(joinedC.message);
    // Both teams had one: the tie goes to the first team.
    expect(joinedC.state.lobby.players.find((p) => p.name === 'Carla')?.team).toBe('a');

    // The host moves Carla, Bruno moves himself: a = Ana + Bruno, b = Carla.
    expect(await ana.emitWithAck('team:assign', { playerId: joinedC.playerId, team: 'b' })).toEqual(
      { ok: true },
    );
    const moved = waitFor(ana, 'lobby:update');
    expect(await bruno.emitWithAck('team:join', { team: 'a' })).toEqual({ ok: true });
    const lobby = await moved;
    expect(lobby.players.map((p) => [p.name, p.team])).toEqual([
      ['Ana', 'a'],
      ['Bruno', 'a'],
      ['Carla', 'b'],
    ]);

    // Members name and colour their own team; a rival cannot.
    expect(
      await bruno.emitWithAck('team:customize', { team: 'a', name: 'Los Rápidos', color: 'green' }),
    ).toEqual({ ok: true });
    expect(await carla.emitWithAck('team:customize', { team: 'a', name: 'X' })).toMatchObject({
      ok: false,
      code: 'not_in_team',
    });

    // --- round ----------------------------------------------------------
    const anaRound = waitFor(ana, 'round:start');
    const brunoRound = waitFor(bruno, 'round:start');
    await ana.emitWithAck('room:start');
    const round: RoundState = await anaRound;
    await brunoRound;
    expect(round.mode).toBe('teams');
    expect(round.myTeam).toBe('a');
    expect(round.teams.map((t) => t.id)).toEqual(['a', 'b']);
    expect(round.teammates).toEqual([{ playerId: joinedB.playerId, rows: [] }]);

    // Ana's word reaches Bruno with its letters: teammates see each other live.
    const mateRows = waitFor(bruno, 'teammate:progress');
    const miss = await ana.emitWithAck('game:guess', { word: WRONG });
    if (!miss.ok) throw new Error(miss.message);
    expect(await mateRows).toEqual({
      playerId: created.playerId,
      rows: [{ word: WRONG, colors: miss.colors }],
    });

    // One hint per team: Ana spends it, Bruno sees it, Bruno cannot spend another.
    const teamHint = waitFor(bruno, 'team:hint');
    const hint = await ana.emitWithAck('game:hint');
    if (!hint.ok) throw new Error(hint.message);
    expect(await teamHint).toEqual({
      letter: hint.letter,
      kind: hint.kind,
      position: hint.position,
    });
    expect(await bruno.emitWithAck('game:hint')).toMatchObject({
      ok: false,
      code: 'hint_already_used',
    });

    // Carla solves for team b: team a's shared clock takes the hit once, both members told.
    const penalty = waitFor<'time:penalty'>(ana, 'time:penalty');
    const carlaSolve = await carla.emitWithAck('game:guess', { word: ANSWER });
    if (!carlaSolve.ok) throw new Error(carlaSolve.message);
    expect(carlaSolve.solved).toBe(true);
    const hit: PenaltyPayload = await penalty;
    expect(hit.seconds).toBe(SCORING.penaltyOnRivalSolveSeconds);
    expect(hit.clocks.map((c) => c.playerId).sort()).toEqual(
      [created.playerId, joinedB.playerId].sort(),
    );
    expect(hit.clocks[0].secondsLeft).toBe(hit.clocks[1].secondsLeft);

    // Ana solves for team a: the team is second, and with both teams done the
    // round closes on the spot, so Bruno's next word finds no round at all.
    const end = waitFor<'round:end'>(ana, 'round:end');
    const anaSolve = await ana.emitWithAck('game:guess', { word: ANSWER });
    if (!anaSolve.ok) throw new Error(anaSolve.message);
    expect(anaSolve.solvedPosition).toBe(2);
    expect(await bruno.emitWithAck('game:guess', { word: WRONG })).toMatchObject({
      ok: false,
      code: 'not_in_round',
    });

    // --- scoring: one line per team, none per player -----------------------
    const payload: RoundEndPayload = await end;
    expect(payload.mode).toBe('teams');
    expect(payload.breakdown).toEqual([]);
    expect(payload.standings).toEqual([]);
    const a = payload.teams.find((t) => t.team === 'a')!;
    const b = payload.teams.find((t) => t.team === 'b')!;
    expect(a).toMatchObject({
      name: 'Los Rápidos',
      color: 'green',
      solved: true,
      solverId: created.playerId,
      solverName: 'Ana',
      position: 2,
      solveBonus: 40,
      // Ana's second word is the team's only paid attempt.
      attemptsAfterFirst: 1,
      attemptPenalty: -4,
      positionBonus: 0,
      hintBonus: 0,
    });
    expect(b).toMatchObject({
      solved: true,
      position: 1,
      positionBonus: SCORING.teamFirstBonus,
      hintBonus: 10,
      attemptsAfterFirst: 0,
    });
    expect(a.roundPoints).toBe(Math.max(40, a.timePoints + 40 - 4));
    expect(b.roundPoints).toBe(Math.max(40, b.timePoints + 40 + 20 + 10));
    // The round and the game go to team b, and the games counter outlives the round.
    expect(payload.teamStandings[0]).toMatchObject({
      team: 'b',
      rank: 1,
      roundsWon: 1,
      gamesWon: 1,
    });
    expect(payload.teamStandings[1]).toMatchObject({
      team: 'a',
      rank: 2,
      roundsWon: 0,
      gamesWon: 0,
    });

    ana.disconnect();
    bruno.disconnect();
    carla.disconnect();
  }, 20000);
});
