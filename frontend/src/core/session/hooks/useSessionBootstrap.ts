import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { pathForStatus } from '@/shared/routes/paths';

/**
 * On first mount: bind socket listeners and, when a session is stored, rejoin
 * the room and route by the returned status. Runs once (StrictMode-safe).
 */
export const useSessionBootstrap = () => {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const store = useSessionStore.getState();
    store.bind();

    if (!store.session) {
      store.markBootstrapped();
      return;
    }

    // `initial` marks the re-entry rejoin: a finished room expires the session
    // instead of restoring it.
    void store.rejoin({ initial: true }).then((state) => {
      if (state) {
        navigate(pathForStatus(state.lobby.status, state.lobby.code), { replace: true });
      }
      useSessionStore.getState().markBootstrapped();
    });
  }, [navigate]);
};
