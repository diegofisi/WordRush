import { create } from 'zustand';

import { socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import type { FullState, GameEndPayload, RoundEndPayload } from '@/shared/contract';

interface ResultsState {
  roundEnd: RoundEndPayload | null;
  gameEnd: GameEndPayload | null;
  /** Epoch ms when the next round starts; null when unknown or the game ended. */
  nextRoundAt: number | null;
  /** Round number of the latest `round:start`; > roundEnd.round means play resumed. */
  latestRoundStarted: number | null;
}

interface ResultsActions {
  bind: () => void;
  reset: () => void;
}

let bound = false;

const initialState: ResultsState = {
  roundEnd: null,
  gameEnd: null,
  nextRoundAt: null,
  latestRoundStarted: null,
};

export const useResultsStore = create<ResultsState & ResultsActions>((set) => {
  const hydrate = (snapshot: FullState) => {
    const roundEnd = snapshot.lastRoundEnd;
    const finished = snapshot.lobby.status === 'finished';
    set({
      roundEnd,
      gameEnd:
        finished && roundEnd
          ? { standings: roundEnd.standings, rounds: roundEnd.totalRounds }
          : null,
      // The snapshot's nextRoundIn was computed when the round ended; it is only an estimate here.
      nextRoundAt:
        roundEnd && !finished && roundEnd.nextRoundIn > 0
          ? Date.now() + roundEnd.nextRoundIn * 1000
          : null,
      latestRoundStarted: snapshot.round?.round ?? null,
    });
  };

  return {
    ...initialState,

    bind: () => {
      if (bound) return;
      bound = true;

      socket.on('round:end', (payload) =>
        set({
          roundEnd: payload,
          gameEnd: null,
          nextRoundAt: payload.nextRoundIn > 0 ? Date.now() + payload.nextRoundIn * 1000 : null,
        }),
      );
      socket.on('game:end', (payload) => set({ gameEnd: payload, nextRoundAt: null }));
      socket.on('round:start', (round) => set({ latestRoundStarted: round.round }));

      const current = useSessionStore.getState().snapshot;
      if (current) hydrate(current);
      useSessionStore.subscribe((state, previous) => {
        if (state.snapshot && state.snapshot !== previous.snapshot) hydrate(state.snapshot);
        if (!state.session && previous.session) set(initialState);
      });
    },

    reset: () => set(initialState),
  };
});
