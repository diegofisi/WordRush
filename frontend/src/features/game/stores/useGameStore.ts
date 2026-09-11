import { create } from 'zustand';

import { socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { getT } from '@/shared/i18n';
import {
  MAX_ATTEMPTS,
  ROOM_LIMITS,
  WORD_LENGTH,
  type FullState,
  type GuessAck,
  type HintAck,
  type LobbyState,
  type PlayerProgress,
  type RoomSettings,
  type RoundInfo,
  type RoundState,
  type SelfState,
} from '@/shared/contract';

import { toast } from '@/shared/stores/useToastStore';

import type { FeedEvent, GainChip, ReactionBubble, RosterEntry } from '../models/game.model';

export type GameStatus = 'idle' | 'playing' | 'ended';

const LOW_TIME_SECONDS = 15;
const GREENS_ANNOUNCE_AT = 4;
const REACTION_MS = 2_500;
/** Flip (560 ms) + stagger of the last tile; after this the reveal is static. */
const REVEAL_MS = 560 + 4 * 110 + 100;
const MAX_FEED = 40;

interface Announced {
  greens: string[];
  lowTime: string[];
  finished: string[];
}

interface GameState {
  status: GameStatus;
  round: RoundInfo | null;
  settings: RoomSettings | null;
  roster: Record<string, RosterEntry>;
  myId: string | null;
  me: SelfState | null;
  /** Everyone's colours-only progress, keyed by player id (includes me). */
  players: Record<string, PlayerProgress>;
  /** Players who gave up their seat this round: id -> name, kept for the panel. */
  left: Record<string, string>;
  solvedCount: number;
  feed: FeedEvent[];
  reactions: Record<string, ReactionBubble>;
  /** Time chips from my latest guess. */
  gains: GainChip[];
  draft: string;
  /** Row index whose tiles should flip-reveal; null when nothing is pending. */
  revealRow: number | null;
  shakeKey: number;
  emoteCooldownUntil: number;
  announced: Announced;
}

interface GameActions {
  bind: () => void;
  reset: () => void;
  typeLetter: (letter: string) => void;
  backspace: () => void;
  shake: () => void;
  applyGuessAck: (ack: GuessAck, word: string) => void;
  applyHintAck: (ack: HintAck) => void;
  startEmoteCooldown: () => void;
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
  initialSeconds: round.initialSeconds,
  startedAt: round.startedAt,
  hintAvailable: round.hintAvailable,
});

/** Roster entries rebuilt from the players who left, so their names survive. */
const leftRoster = (left: Record<string, string>): Record<string, RosterEntry> =>
  Object.fromEntries(
    Object.entries(left).map(([id, name]) => [id, { name, connected: false }]),
  );

const rosterOf = (lobby: LobbyState): Record<string, RosterEntry> =>
  Object.fromEntries(
    lobby.players.map((player) => [player.id, { name: player.name, connected: player.connected }]),
  );

const initialState: GameState = {
  status: 'idle',
  round: null,
  settings: null,
  roster: {},
  myId: null,
  me: null,
  players: {},
  left: {},
  solvedCount: 0,
  feed: [],
  reactions: {},
  gains: [],
  draft: '',
  revealRow: null,
  shakeKey: 0,
  emoteCooldownUntil: 0,
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
      me: round.me,
      players: Object.fromEntries(round.players.map((player) => [player.playerId, player])),
      left: {},
      solvedCount: round.players.filter((player) => player.solved).length,
      feed: [],
      reactions: {},
      gains: [],
      draft: '',
      revealRow: null,
      shakeKey: 0,
      announced: emptyAnnounced(),
    });

  const hydrate = (snapshot: FullState) => {
    set({
      settings: snapshot.lobby.settings,
      roster: rosterOf(snapshot.lobby),
      myId: useSessionStore.getState().session?.playerId ?? null,
    });
    if (snapshot.round) {
      applyRound(snapshot.round, snapshot.lobby.status === 'playing' ? 'playing' : 'ended');
    } else {
      set({ status: 'idle', round: null, me: null, players: {}, left: {} });
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
                hintUsed: progress.hintUsed,
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
    if (
      progress.finished &&
      !progress.solved &&
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
        kind: progress.rows.length >= MAX_ATTEMPTS ? 'out-of-attempts' : 'out-of-time',
        playerId: progress.playerId,
      });
    }
  };

  return {
    ...initialState,

    bind: () => {
      if (bound) return;
      bound = true;

      socket.on('round:start', (round) => applyRound(round, 'playing'));
      socket.on('player:progress', onProgress);
      socket.on('player:solved', (payload) => {
        set((state) => ({ solvedCount: Math.max(state.solvedCount, payload.position) }));
        pushFeed({ kind: 'solved', playerId: payload.playerId, position: payload.position });
      });
      socket.on('player:hint', (payload) => {
        set((state) => {
          const current = state.players[payload.playerId];
          return current
            ? { players: { ...state.players, [payload.playerId]: { ...current, hintUsed: true } } }
            : {};
        });
        pushFeed({ kind: 'hint', playerId: payload.playerId });
      });
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
      socket.on('reaction:show', (payload) => {
        const stamp = Date.now();
        set((state) => ({
          reactions: { ...state.reactions, [payload.playerId]: { emote: payload.emote, stamp } },
        }));
        pushFeed({ kind: 'reaction', playerId: payload.playerId, emote: payload.emote });
        window.setTimeout(() => {
          set((state) => {
            if (state.reactions[payload.playerId]?.stamp !== stamp) return {};
            const { [payload.playerId]: _gone, ...rest } = state.reactions;
            return { reactions: rest };
          });
        }, REACTION_MS);
      });
      socket.on('round:end', () => set({ status: 'ended', draft: '' }));
      socket.on('game:end', () => set({ status: 'ended', draft: '' }));
      socket.on('lobby:update', (lobby) =>
        set((state) => ({
          // Whoever left is no longer in the room; keep their name so the panel
          // and the feed can still show who they were.
          roster: { ...leftRoster(state.left), ...rosterOf(lobby) },
          settings: lobby.settings,
        })),
      );
      socket.on('player:left', (payload) => {
        const t = getT();
        set((state) => ({
          left: { ...state.left, [payload.playerId]: payload.name },
          roster: {
            ...state.roster,
            [payload.playerId]: { name: payload.name, connected: false },
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
      const { status, me, draft } = get();
      if (status !== 'playing' || !me || me.finished) return;
      if (draft.length >= WORD_LENGTH) return;
      set({ draft: draft + letter.toUpperCase() });
    },

    backspace: () => set((state) => ({ draft: state.draft.slice(0, -1) })),

    shake: () => set((state) => ({ shakeKey: state.shakeKey + 1 })),

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
                hint: { letter: ack.letter },
                secondsLeft: ack.secondsLeft,
                at: ack.at,
              },
            }
          : {},
      ),

    startEmoteCooldown: () =>
      set({ emoteCooldownUntil: Date.now() + ROOM_LIMITS.emoteCooldownSeconds * 1000 }),

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
