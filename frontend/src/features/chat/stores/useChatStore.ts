import { create } from 'zustand';

import { request, socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import type { ChatHistoryAck, ChatMessage } from '@/shared/contract';
import { playSound } from '@/shared/lib/sound';

interface ChatState {
  /** The current game's messages I may read, oldest first. */
  messages: ChatMessage[];
  /** Messages arrived while the phone sheet was closed. */
  unread: number;
  /** Phone only: the chat sheet is open. */
  open: boolean;
}

interface ChatActions {
  bind: () => void;
  reset: () => void;
  /** Asks the server for everything I may read now; replaces the list. */
  refresh: () => Promise<void>;
  setOpen: (open: boolean) => void;
}

let bound = false;

const byId = (messages: ChatMessage[]) =>
  [...new Map(messages.map((message) => [message.id, message])).values()].sort(
    (first, second) => first.id - second.id,
  );

/**
 * docs/context/06-v1.1.md -> Chat. Live messages arrive on `chat:message`
 * only when I may read them; what I was not allowed to see while guessing
 * (the finished players' talk) is fetched when the round ends, so the results
 * screen always holds the whole round.
 */
export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  unread: 0,
  open: false,

  bind: () => {
    if (bound) return;
    bound = true;

    socket.on('chat:message', (message) => {
      // Only somebody else's message pings; my own is not news to me.
      if (message.playerId !== useSessionStore.getState().session?.playerId) {
        playSound('chatMessage');
      }
      set((state) => ({
        messages: byId([...state.messages, message]),
        unread: state.open ? 0 : state.unread + 1,
      }));
    });
    // The round's hidden talk becomes history for everybody: fetch it.
    socket.on('round:end', () => void get().refresh());
    // A player who finished the round may now read what was hidden from them;
    // the same `player:progress` that freezes their board triggers the fetch.
    socket.on('player:progress', (progress) => {
      const myId = useSessionStore.getState().session?.playerId;
      if (progress.playerId === myId && progress.finished) void get().refresh();
    });
    // Team mode: "finished" is the team's; refetch only when a team just finished,
    // not on every clock update (one arrives per word typed).
    let finishedTeams = new Set<string>();
    socket.on('team:clocks', (teams) => {
      const now = new Set(teams.filter((team) => team.finished).map((team) => team.id));
      const changed = [...now].some((id) => !finishedTeams.has(id));
      finishedTeams = now;
      if (changed) void get().refresh();
    });
    socket.on('round:start', () => {
      finishedTeams = new Set();
    });
    // "Play again" starts a new chat on the server: drop the old one here too.
    socket.on('lobby:update', (lobby) => {
      if (lobby.status === 'lobby') void get().refresh();
    });

    const current = useSessionStore.getState().snapshot;
    if (current) void get().refresh();
    useSessionStore.subscribe((state, previous) => {
      if (state.snapshot && state.snapshot !== previous.snapshot) void get().refresh();
      if (!state.session && previous.session) get().reset();
    });
  },

  reset: () => set({ messages: [], unread: 0, open: false }),

  refresh: async () => {
    if (!useSessionStore.getState().session) return;
    const result = await request<ChatHistoryAck>((ack) => socket.emit('chat:history', ack));
    if (!result.ok) return;
    set((state) => ({
      messages: byId(result.value.messages),
      unread: state.open ? 0 : Math.min(state.unread, result.value.messages.length),
    }));
  },

  setOpen: (open) => set({ open, unread: open ? 0 : get().unread }),
}));
