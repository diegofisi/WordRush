import { create } from 'zustand';

import { socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { getT } from '@/shared/i18n';
import { playSound, playTileReveal } from '@/shared/lib/sound';
import {
  PHRASE_RULES,
  ROOM_LIMITS,
  type FullState,
  type GuessAck,
  type HintAck,
  type LobbyState,
  type ObserverPublic,
  type OwnRow,
  type PhraseAck,
  type Role,
  type PlayerProgress,
  type RoomSettings,
  type RoundInfo,
  type RoundState,
  type SelfState,
  type TeamId,
  type TeamPublic,
  type TeamRoundState,
} from '@/shared/contract';

import { toast } from '@/shared/stores/useToastStore';

import type { FeedEvent, GainChip, RosterEntry, StickerFlash } from '../models/game.model';

export type GameStatus = 'idle' | 'playing' | 'ended';

const LOW_TIME_SECONDS = 15;
const EMOTE_WINDOW_MS = ROOM_LIMITS.emoteBurstWindowSeconds * 1000;
const EMOTE_PAUSE_MS = ROOM_LIMITS.emotePauseSeconds * 1000;
const GREENS_ANNOUNCE_AT = 4;
/** How long the phone overlay keeps the newest sticker on screen. */
const STICKER_MS = 2_500;
/** The board's own flip stagger (`Board.tsx`), which the reveal tick follows. */
const FLIP_STAGGER_MS = 110;
/** Flip (560 ms) + stagger of the last tile; after this the reveal is static. */
const REVEAL_MS = 560 + 4 * FLIP_STAGGER_MS + 100;
const MAX_FEED = 40;
/** How long the inline guess-error caption stays under the current row. */
const NOTICE_MS = 1_600;

interface Announced {
  greens: string[];
  lowTime: string[];
  finished: string[];
}

interface GameState {
  status: GameStatus;
  round: RoundInfo | null;
  /** Seated or observing this round. */
  role: Role;
  settings: RoomSettings | null;
  roster: Record<string, RosterEntry>;
  myId: string | null;
  me: SelfState | null;
  /** Everyone's colours-only progress, keyed by player id (includes me). */
  players: Record<string, PlayerProgress>;
  /** Players who gave up their seat this round: id -> name, kept for the panel. */
  left: Record<string, string>;
  /** Team mode: both teams' names, colours and rounds won (from the lobby). */
  teamInfo: TeamPublic[];
  /** Who watches the room (from the lobby); my own seat wish lives here too. */
  observers: ObserverPublic[];
  /** Team mode: the shared clocks and solves this round, keyed by team id. */
  teams: Partial<Record<TeamId, TeamRoundState>>;
  myTeam: TeamId | null;
  /** Team mode: my teammates' boards with letters, keyed by player id. */
  teammates: Record<string, OwnRow[]>;
  solvedCount: number;
  feed: FeedEvent[];
  /** Newest sticker from anyone (me included); the phone overlay reads it. */
  sticker: StickerFlash | null;
  /** Time chips from my latest guess. */
  gains: GainChip[];
  draft: string;
  /** Row index whose tiles should flip-reveal; null when nothing is pending. */
  revealRow: number | null;
  shakeKey: number;
  /** Guess error printed under the current row (never a toast); already translated. */
  guessNotice: { id: number; text: string } | null;
  /** Epoch ms of my recent emote sends; the local half of the burst rule. */
  emoteSends: number[];
  /** Epoch ms until which emotes are refused after a burst; 0 when free. */
  emotePausedUntil: number;
  announced: Announced;
  /** Phrase game: the modal is open; the last miss's wrong letters. */
  phraseOpen: boolean;
  phraseWrong: boolean[][] | null;
  /** My own solve order, from my ack: `players` may lag behind by an event. */
  mySolvedPosition: number | null;
}

interface GameActions {
  bind: () => void;
  reset: () => void;
  typeLetter: (letter: string) => void;
  backspace: () => void;
  /** Shows the inline guess error under the current row and shakes it. */
  noticeGuess: (text: string) => void;
  applyGuessAck: (ack: GuessAck, word: string) => void;
  applyHintAck: (ack: HintAck) => void;
  /** Phrase game: the answer to a send; a miss keeps the modal open. */
  applyPhraseAck: (ack: PhraseAck) => void;
  setPhraseOpen: (open: boolean) => void;
  /** Applies the burst rule locally; false means "do not send this one". */
  tryEmote: () => boolean;
  /** Starts the 5 s pause and toasts once, never on every blocked click. */
  pauseEmotes: () => void;
  announceLowTime: (playerId: string) => void;
}

let bound = false;
let nextId = 1;

/** `Omit` that distributes over the FeedEvent union instead of collapsing it. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type FeedInput = DistributiveOmit<FeedEvent, 'id' | 'atSeconds' | 'at' | 'name' | 'isMe'>;

const emptyAnnounced = (): Announced => ({ greens: [], lowTime: [], finished: [] });

/** Phrase game: a letter that came back grey is not in the phrase. */
const isRuledOut = (rows: OwnRow[], letter: string): boolean => {
  const wanted = letter.toLowerCase();
  return rows.some((row) =>
    [...row.word].some((ch, index) => ch === wanted && row.colors[index] === 'gray'),
  );
};

const roundInfoOf = (round: RoundState): RoundInfo => ({
  round: round.round,
  totalRounds: round.totalRounds,
  mode: round.mode,
  game: round.game,
  phraseWords: round.phraseWords,
  initialSeconds: round.initialSeconds,
  startedAt: round.startedAt,
  hintAvailable: round.hintAvailable,
  wordLength: round.wordLength,
  maxAttempts: round.maxAttempts,
});

/** Roster entries rebuilt from the players who left, so their names survive. */
const leftRoster = (left: Record<string, string>): Record<string, RosterEntry> =>
  Object.fromEntries(
    Object.entries(left).map(([id, name]) => [id, { name, connected: false, team: null }]),
  );

/** Players and observers alike: the stream names whoever arrives or speaks. */
const rosterOf = (lobby: LobbyState): Record<string, RosterEntry> => {
  const entries: [string, RosterEntry][] = [
    ...lobby.observers.map((observer): [string, RosterEntry] => [
      observer.id,
      { name: observer.name, connected: observer.connected, team: null },
    ]),
    ...lobby.players.map((player): [string, RosterEntry] => [
      player.id,
      { name: player.name, connected: player.connected, team: player.team },
    ]),
  ];
  return Object.fromEntries(entries);
};

const teamsOf = (teams: TeamRoundState[]): Partial<Record<TeamId, TeamRoundState>> =>
  Object.fromEntries(teams.map((team) => [team.id, team]));

const initialState: GameState = {
  status: 'idle',
  round: null,
  role: 'player',
  settings: null,
  roster: {},
  myId: null,
  me: null,
  players: {},
  left: {},
  teamInfo: [],
  observers: [],
  teams: {},
  myTeam: null,
  teammates: {},
  solvedCount: 0,
  feed: [],
  sticker: null,
  gains: [],
  draft: '',
  revealRow: null,
  shakeKey: 0,
  guessNotice: null,
  emoteSends: [],
  emotePausedUntil: 0,
  announced: emptyAnnounced(),
  phraseOpen: false,
  phraseWrong: null,
  mySolvedPosition: null,
};

export const useGameStore = create<GameState & GameActions>((set, get) => {
  const secondsSinceStart = () => {
    const startedAt = get().round?.startedAt ?? Date.now();
    return Math.max(0, (Date.now() - startedAt) / 1000);
  };

  const pushFeed = (event: FeedInput) => {
    const { roster, myId } = get();
    const base = {
      id: nextId++,
      atSeconds: secondsSinceStart(),
      at: Date.now(),
      name: roster[event.playerId]?.name ?? '?',
      isMe: event.playerId === myId,
    };
    set((state) => ({
      feed: [...state.feed, { ...base, ...event } as FeedEvent].slice(-MAX_FEED),
    }));
  };

  const applyRound = (round: RoundState, status: GameStatus) =>
    set({
      status,
      round: roundInfoOf(round),
      role: round.role,
      me: round.me,
      mySolvedPosition:
        round.players.find((p) => p.playerId === useSessionStore.getState().session?.playerId)
          ?.solvedPosition ?? null,
      players: Object.fromEntries(round.players.map((player) => [player.playerId, player])),
      left: {},
      teams: teamsOf(round.teams),
      myTeam: round.myTeam,
      teammates: Object.fromEntries(round.teammates.map((mate) => [mate.playerId, mate.rows])),
      solvedCount: round.players.filter((player) => player.solved).length,
      feed: [],
      sticker: null,
      gains: [],
      draft: '',
      revealRow: null,
      shakeKey: 0,
      guessNotice: null,
      announced: emptyAnnounced(),
      phraseOpen: false,
      phraseWrong: null,
    });

  const hydrate = (snapshot: FullState) => {
    set({
      settings: snapshot.lobby.settings,
      roster: rosterOf(snapshot.lobby),
      teamInfo: snapshot.lobby.teams,
      observers: snapshot.lobby.observers,
      myId: useSessionStore.getState().session?.playerId ?? null,
    });
    if (snapshot.round) {
      applyRound(snapshot.round, snapshot.lobby.status === 'playing' ? 'playing' : 'ended');
    } else {
      set({
        status: 'idle',
        round: null,
        me: null,
        players: {},
        left: {},
        teams: {},
        myTeam: null,
        teammates: {},
      });
    }
  };

  const onProgress = (progress: PlayerProgress) => {
    const { myId, announced, left } = get();
    set((state) => ({ players: { ...state.players, [progress.playerId]: progress } }));

    if (progress.playerId === myId) {
      set((state) =>
        state.me
          ? {
              me: {
                ...state.me,
                secondsLeft: progress.secondsLeft,
                at: progress.at,
                solved: progress.solved,
                finished: progress.finished,
                penaltySeconds: progress.penaltySeconds,
              },
            }
          : {},
      );
      return;
    }

    if (
      !progress.solved &&
      progress.greens >= GREENS_ANNOUNCE_AT &&
      !announced.greens.includes(progress.playerId)
    ) {
      set((state) => ({
        announced: { ...state.announced, greens: [...state.announced.greens, progress.playerId] },
      }));
      pushFeed({ kind: 'greens', playerId: progress.playerId, greens: progress.greens });
    }
    // Whoever left already has their own feed line; do not also call it a timeout.
    // In team mode a member stops when their team does; the team line says so.
    if (
      progress.finished &&
      !progress.solved &&
      get().round?.mode !== 'teams' &&
      !(progress.playerId in left) &&
      !announced.finished.includes(progress.playerId)
    ) {
      set((state) => ({
        announced: {
          ...state.announced,
          finished: [...state.announced.finished, progress.playerId],
        },
      }));
      pushFeed({
        kind: progress.phrase
          ? progress.phrase.sendsUsed >= PHRASE_RULES.sends
            ? 'out-of-sends'
            : 'out-of-time'
          : progress.rows.length >= (get().round?.maxAttempts ?? 8)
            ? 'out-of-attempts'
            : 'out-of-time',
        playerId: progress.playerId,
      });
    }
  };

  return {
    ...initialState,

    bind: () => {
      if (bound) return;
      bound = true;

      socket.on('round:start', (round) => {
        applyRound(round, 'playing');
        playSound('gameStarted');
      });
      socket.on('player:progress', onProgress);
      // Team mode: a teammate's board, letters included.
      socket.on('teammate:progress', (payload) =>
        set((state) => ({
          teammates: { ...state.teammates, [payload.playerId]: payload.rows },
          // Phrase game: the phrase is the team's; a teammate's word moved it for me too.
          me: state.me && payload.phrase ? { ...state.me, phrase: payload.phrase } : state.me,
        })),
      );
      // Team mode: the hint is the team's; a teammate spent it, my board shows it.
      socket.on('team:hint', (reveal) => {
        playSound('hintUsed');
        set((state) => (state.me ? { me: { ...state.me, hintUsed: true, hint: reveal } } : {}));
      });
      socket.on('team:clocks', (teams) => {
        const { myTeam, teams: before } = get();
        for (const team of teams) {
          const previous = before[team.id];
          if (team.finished && !team.solved && !(previous?.finished && !previous.solved)) {
            const info = get().teamInfo.find((entry) => entry.id === team.id);
            pushFeed({
              kind: 'team-finished',
              playerId: '',
              teamName: info?.name.trim() || getT().lobby.teamDefault(team.id),
              reason:
                team.secondsLeft <= 0
                  ? 'time'
                  : get().round?.game === 'phrase'
                    ? 'sends'
                    : 'attempts',
            });
          }
        }
        const mine = teams.find((team) => team.id === myTeam);
        set((state) => ({
          teams: teamsOf(teams),
          me:
            state.me && mine
              ? {
                  ...state.me,
                  secondsLeft: mine.secondsLeft,
                  at: mine.at,
                  finished: mine.finished,
                  hintUsed: mine.hintUsed,
                  penaltySeconds: mine.penaltySeconds,
                  // The phrase is the team's: its counters move with any member.
                  phrase:
                    state.me.phrase && mine.phrase
                      ? {
                          ...state.me.phrase,
                          found: mine.phrase.found,
                          total: mine.phrase.total,
                          sendsUsed: mine.phrase.sendsUsed,
                          completed: mine.phrase.completed,
                        }
                      : state.me.phrase,
                }
              : state.me,
        }));
      });
      socket.on('player:solved', (payload) => {
        // My own solve rings with the reveal (`applyGuessAck`); a rival's costs
        // me 5 s, and that is what this two-note says.
        if (payload.playerId !== get().myId) playSound('rivalSolved');
        set((state) => ({ solvedCount: Math.max(state.solvedCount, payload.position) }));
        pushFeed({
          kind: get().round?.game === 'phrase' ? 'phrase-completed' : 'solved',
          playerId: payload.playerId,
          position: payload.position,
        });
      });
      // Phrase game: a hit already arrived as `player:solved`; only the misses are news.
      socket.on('phrase:attempt', (payload) => {
        if (!payload.correct) pushFeed({ kind: 'phrase-missed', playerId: payload.playerId });
      });
      // Anonymous: the feed says a hint was spent, never by whom.
      socket.on('player:hint', () => pushFeed({ kind: 'hint', playerId: '' }));
      socket.on('time:penalty', (payload) => {
        const { myId } = get();
        if (payload.clocks.some((clock) => clock.playerId === myId)) playSound('penalty');
        set((state) => {
          const players = { ...state.players };
          let me = state.me;
          for (const clock of payload.clocks) {
            const current = players[clock.playerId];
            if (current) {
              players[clock.playerId] = {
                ...current,
                secondsLeft: clock.secondsLeft,
                at: clock.at,
              };
            }
            if (clock.playerId === myId && me) {
              me = {
                ...me,
                secondsLeft: clock.secondsLeft,
                at: clock.at,
                penaltySeconds: me.penaltySeconds + payload.seconds,
              };
            }
          }
          return { players, me };
        });
      });
      // Every sticker, mine included, is a message in the feed. The phone has no
      // feed panel, so the newest one also feeds the 2.5 s overlay there.
      socket.on('reaction:show', (payload) => {
        playSound('sticker');
        pushFeed({ kind: 'reaction', playerId: payload.playerId, emote: payload.emote });
        const id = nextId++;
        set((state) => ({
          sticker: {
            id,
            emote: payload.emote,
            name: state.roster[payload.playerId]?.name ?? '?',
          },
        }));
        window.setTimeout(() => {
          set((state) => (state.sticker?.id === id ? { sticker: null } : {}));
        }, STICKER_MS);
      });
      socket.on('round:end', (payload) => {
        set((state) => ({
          status: 'ended',
          draft: '',
          // The rounds-won counter in the header follows the round that just ended.
          teamInfo: state.teamInfo.map((team) => {
            const standing = payload.teamStandings.find((entry) => entry.team === team.id);
            return standing ? { ...team, roundsWon: standing.roundsWon } : team;
          }),
        }));
        playSound('roundEnded');
      });
      socket.on('game:end', () => set({ status: 'ended', draft: '' }));
      socket.on('lobby:update', (lobby) => {
        // Somebody new in the room while the round runs (an observer, or a
        // player back for the next one) is a line in the room's stream.
        const known = get().roster;
        const arrivals = [...lobby.players, ...lobby.observers].filter(
          (person) => !(person.id in known) && person.id !== get().myId,
        );
        set((state) => ({
          // Whoever left is no longer in the room; keep their name so the panel
          // and the feed can still show who they were.
          roster: { ...leftRoster(state.left), ...rosterOf(lobby) },
          settings: lobby.settings,
          teamInfo: lobby.teams,
          observers: lobby.observers,
        }));
        for (const person of arrivals) {
          playSound('playerJoined');
          pushFeed({ kind: 'joined', playerId: person.id });
        }
      });
      socket.on('player:left', (payload) => {
        const t = getT();
        set((state) => ({
          left: { ...state.left, [payload.playerId]: payload.name },
          roster: {
            ...state.roster,
            [payload.playerId]: {
              name: payload.name,
              connected: false,
              team: state.roster[payload.playerId]?.team ?? null,
            },
          },
        }));
        pushFeed({ kind: 'left', playerId: payload.playerId });
        if (payload.playerId !== get().myId) {
          playSound('playerLeft');
          toast.info(t.game.leftToast(payload.name));
        }
        if (payload.newHostId) {
          const hostName = get().roster[payload.newHostId]?.name;
          pushFeed({ kind: 'new-host', playerId: payload.newHostId });
          if (hostName) toast.info(t.game.newHostToast(hostName));
        }
      });

      const current = useSessionStore.getState().snapshot;
      if (current) hydrate(current);
      useSessionStore.subscribe((state, previous) => {
        if (state.snapshot && state.snapshot !== previous.snapshot) hydrate(state.snapshot);
        if (!state.session && previous.session) get().reset();
      });
    },

    reset: () => set({ ...initialState, announced: emptyAnnounced() }),

    typeLetter: (letter) => {
      const { status, me, draft, round } = get();
      if (status !== 'playing' || !me || me.finished || !round) return;
      // Every row used: nothing more to type (the phrase game ends by sends or clock).
      if (me.rows.length >= round.maxAttempts) return;
      if (draft.length >= round.wordLength) return;
      // Phrase game: a letter already ruled out is refused, its key is disabled.
      if (round.game === 'phrase' && isRuledOut(me.rows, letter)) return;
      playSound('keyTap');
      set({ draft: draft + letter.toUpperCase() });
    },

    backspace: () => set((state) => ({ draft: state.draft.slice(0, -1) })),

    noticeGuess: (text) => {
      playSound('invalidWord');
      const id = nextId++;
      set((state) => ({ shakeKey: state.shakeKey + 1, guessNotice: { id, text } }));
      window.setTimeout(() => {
        set((state) => (state.guessNotice?.id === id ? { guessNotice: null } : {}));
      }, NOTICE_MS);
    },

    applyGuessAck: (ack, word) => {
      const revealRow = get().me?.rows.length ?? 0;
      // The reveal is heard as it is seen: one tick per tile of the flip
      // stagger, then what the row was worth.
      playTileReveal(word.length, FLIP_STAGGER_MS);
      const greens = ack.gains.some((gain) => gain.kind === 'green');
      const yellows = ack.gains.some((gain) => gain.kind === 'yellow');
      if (ack.solved) {
        window.setTimeout(() => playSound('solved'), REVEAL_MS);
      } else {
        if (greens) window.setTimeout(() => playSound('letterPlaced'), REVEAL_MS);
        if (yellows) window.setTimeout(() => playSound('letterFound'), REVEAL_MS + 400);
      }
      // Clear the reveal marker so a remounted board (layout switch, back navigation) stays static.
      window.setTimeout(() => {
        set((state) => (state.revealRow === revealRow ? { revealRow: null } : {}));
      }, REVEAL_MS);
      set((state) => {
        if (!state.me) return {};
        const rows = [...state.me.rows, { word: word.toLowerCase(), colors: ack.colors }];
        return {
          me: {
            ...state.me,
            rows,
            secondsLeft: ack.secondsLeft,
            at: ack.at,
            solved: ack.solved,
            finished: ack.finished,
            phrase: ack.phrase ?? state.me.phrase,
          },
          gains: ack.gains.map((gain) => ({
            id: nextId++,
            letter: gain.letter.toUpperCase(),
            seconds: gain.seconds,
            kind: gain.kind,
          })),
          draft: '',
          shakeKey: 0,
          guessNotice: null,
          revealRow: rows.length - 1,
          mySolvedPosition: ack.solved ? ack.solvedPosition : state.mySolvedPosition,
          solvedCount: ack.solved
            ? Math.max(state.solvedCount, ack.solvedPosition ?? state.solvedCount + 1)
            : state.solvedCount,
        };
      });
    },

    applyHintAck: (ack) => {
      playSound('hintUsed');
      return set((state) =>
        state.me
          ? {
              me: {
                ...state.me,
                hintUsed: true,
                hint: { letter: ack.letter, kind: ack.kind, position: ack.position },
                secondsLeft: ack.secondsLeft,
                at: ack.at,
              },
            }
          : {},
      );
    },

    applyPhraseAck: (ack) => {
      playSound(ack.correct ? 'solved' : 'invalidWord');
      return set((state) => {
        if (!state.me) return {};
        return {
          me: {
            ...state.me,
            phrase: ack.phrase,
            secondsLeft: ack.secondsLeft,
            at: ack.at,
            solved: ack.correct,
            finished: ack.finished,
          },
          phraseWrong: ack.wrong,
          mySolvedPosition: ack.correct ? ack.solvedPosition : state.mySolvedPosition,
          // A hit or the last miss closes the modal; any other miss keeps it open.
          phraseOpen: !ack.correct && !ack.finished,
          solvedCount: ack.correct
            ? Math.max(state.solvedCount, ack.solvedPosition ?? state.solvedCount + 1)
            : state.solvedCount,
        };
      });
    },

    setPhraseOpen: (open) => set({ phraseOpen: open, ...(open ? {} : { phraseWrong: null }) }),

    // Same rule as the server (docs/context/02-game-rules.md -> Emotes), run
    // locally so most of the spam never leaves the browser.
    tryEmote: () => {
      const now = Date.now();
      if (now < get().emotePausedUntil) return false;
      const recent = get().emoteSends.filter((at) => now - at < EMOTE_WINDOW_MS);
      if (recent.length >= ROOM_LIMITS.emoteBurstLimit) {
        get().pauseEmotes();
        return false;
      }
      set({ emoteSends: [...recent, now] });
      return true;
    },

    pauseEmotes: () => {
      // Already paused: the player has seen the toast, stay quiet.
      if (Date.now() < get().emotePausedUntil) return;
      set({ emotePausedUntil: Date.now() + EMOTE_PAUSE_MS, emoteSends: [] });
      toast.errorText(getT().game.reactionCooldown);
    },

    announceLowTime: (playerId) => {
      if (get().announced.lowTime.includes(playerId)) return;
      set((state) => ({
        announced: { ...state.announced, lowTime: [...state.announced.lowTime, playerId] },
      }));
      pushFeed({ kind: 'low-time', playerId });
    },
  };
});

export const LOW_TIME_THRESHOLD = LOW_TIME_SECONDS;
