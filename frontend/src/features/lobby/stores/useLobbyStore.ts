import { create } from 'zustand';

import { socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { playSound } from '@/shared/lib/sound';

import { toLobbyViewModel, type LobbyViewModel } from '../models/lobby.model';

interface LobbyState {
  lobby: LobbyViewModel | null;
}

interface LobbyActions {
  bind: () => void;
  reset: () => void;
}

let bound = false;

const myId = () => useSessionStore.getState().session?.playerId ?? null;

export const useLobbyStore = create<LobbyState & LobbyActions>((set, get) => ({
  lobby: null,

  bind: () => {
    if (bound) return;
    bound = true;

    socket.on('lobby:update', (dto) => {
      // Somebody new in the waiting room, and it was not me arriving.
      const before = get().lobby;
      const arrived = before && dto.status === 'lobby' && dto.players.length > before.playerCount;
      set({ lobby: toLobbyViewModel(dto, myId()) });
      if (arrived) playSound('playerJoined');
    });
    // The lobby may not receive a lobby:update when the game starts; flip the status locally.
    socket.on('round:start', () =>
      set((state) => (state.lobby ? { lobby: { ...state.lobby, status: 'playing' } } : {})),
    );

    const hydrate = (
      snapshot: NonNullable<ReturnType<typeof useSessionStore.getState>['snapshot']>,
    ) => set({ lobby: toLobbyViewModel(snapshot.lobby, myId()) });

    const current = useSessionStore.getState().snapshot;
    if (current) hydrate(current);
    useSessionStore.subscribe((state, previous) => {
      if (state.snapshot && state.snapshot !== previous.snapshot) hydrate(state.snapshot);
      if (!state.session && previous.session) set({ lobby: null });
    });
  },

  reset: () => set({ lobby: null }),
}));
