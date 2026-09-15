import { create } from 'zustand';

import { socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { getT } from '@/shared/i18n';
import { playSound } from '@/shared/lib/sound';
import {
  ROOM_LIMITS,
  type FullState,
  type GuessAck,
  type HintAck,
  type LobbyState,
  type ObserverPublic,
  type OwnRow,
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
/** Flip (560 ms) + stagger of the last tile; after this the reveal is static. */
const REVEAL_MS = 560 + 4 * 110 + 100;
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
type FeedInput = DistributiveOmit<FeedEvent, 'id' | 'atSeconds' | 'name' | 'isMe'>;

const emptyAnnounced = (): Announced => ({ greens: [], lowTime: [], finished: [] });

const roundInfoOf = (round: RoundState): RoundInfo => ({
  round: round.round,
  totalRounds: round.totalRounds,
  mode: round.mode,
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

const rosterOf = (lobby: LobbyState): Record<string, RosterEntry> =>
  Object.fromEntries(
    lobby.players.map((player) => [
      player.id,
      { name: player.name, connected: player.connected, team: player.team },
    ]),
  );

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
        kind:
          progress.rows.length >= (get().round?.maxAttempts ?? 8)
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
        if (round.round === 1) playSound('gameStarted');
      });
      socket.on('player:progress', onProgress);
      // Team mode: a teammate's board, letters included.
      socket.on('teammate:progress', (payload) =>
        set((state) => ({ teammates: { ...state.teammates, [payload.playerId]: payload.rows } })),
      );
      // Team mode: the hint is the team's; a teammate spent it, my board shows it.
      socket.on('team:hint', (reveal) =>
        set((state) => (state.me ? { me: { ...state.me, hintUsed: true, hint: reveal } } : {})),
      );
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
              reason: team.secondsLeft <= 0 ? 'time' : 'attempts',
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
                }
              : state.me,
        }));
      });
      socket.on('player:solved', (payload) => {
        set((state) => ({ solvedCount: Math.max(state.solvedCount, payload.position) }));
        pushFeed({ kind: 'solved', playerId: payload.playerId, position: payload.position });
      });
      // Anonymous: the feed says a hint was spent, never by whom.
      socket.on('player:hint', () => pushFeed({ kind: 'hint', playerId: '' }));
      socket.on('time:penalty', (payload) => {
        const { myId } = get();
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
      socket.on('lobby:update', (lobby) =>
        set((state) => ({
          // Whoever left is no longer in the room; keep their name so the panel
          // and the feed can still show who they were.
          roster: { ...leftRoster(state.left), ...rosterOf(lobby) },
          settings: lobby.settings,
          teamInfo: lobby.teams,
          observers: lobby.observers,
        })),
      );
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
        if (payload.playerId !== get().myId) toast.info(t.game.leftToast(payload.name));
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
      if (draft.length >= round.wordLength) return;
      set({ draft: draft + letter.toUpperCase() });
    },

    backspace: () => set((state) => ({ draft: state.draft.slice(0, -1) })),

    noticeGuess: (text) => {
      const id = nextId++;
      set((state) => ({ shakeKey: state.shakeKey + 1, guessNotice: { id, text } }));
      window.setTimeout(() => {
        set((state) => (state.guessNotice?.id === id ? { guessNotice: null } : {}));
      }, NOTICE_MS);
    },

    applyGuessAck: (ack, word) => {
      const revealRow = get().me?.rows.length ?? 0;
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
          solvedCount: ack.solved
            ? Math.max(state.solvedCount, ack.solvedPosition ?? state.solvedCount + 1)
            : state.solvedCount,
        };
      });
    },

    applyHintAck: (ack) =>
      set((state) =>
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
      ),

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
