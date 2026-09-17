import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';

import { RequireSession } from '@/core/session/components/RequireSession';
import { SessionReplacedOverlay } from '@/core/session/components/SessionReplacedOverlay';
import { useChatStore } from '@/features/chat';
import { useSessionBootstrap } from '@/core/session/hooks/useSessionBootstrap';
import { useGameStore } from '@/features/game/stores/useGameStore';
import { GamePage } from '@/features/game/pages/GamePage';
import { useLobbyStore } from '@/features/lobby/stores/useLobbyStore';
import { HomePage } from '@/features/lobby/pages/HomePage';
import { LobbyPage } from '@/features/lobby/pages/LobbyPage';
import { RoomEntryPage } from '@/features/lobby/pages/RoomEntryPage';
import { useResultsStore } from '@/features/results/stores/useResultsStore';
import { ResultsPage } from '@/features/results/pages/ResultsPage';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { Button } from '@/shared/components/ui/Button';
import { PageEmpty } from '@/shared/components/ui/PageState';
import { TopBar } from '@/shared/components/layout/TopBar';
import { useT } from '@/shared/i18n';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
import { BOSS_ENABLED } from '@/features/boss/bossEnabled';
import { BossBrainPage } from '@/features/boss/pages/BossBrainPage';
import { isBrainPath } from '@/shared/routes/paths';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.
import { PATHS } from '@/shared/routes/paths';

const NotFoundPage = () => {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col">
      <TopBar bare />
      <PageEmpty
        title="404"
        body={t.common.notFound}
        action={
          <Button
            onClick={() => {
              window.location.assign(PATHS.home);
            }}
          >
            {t.common.backHome}
          </Button>
        }
      />
    </div>
  );
};

/** Binds every socket-driven store once, then bootstraps the stored session. */
const Bootstrap = () => {
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
  // The brain tab opts out of all of it: it opens no socket, claims no session
  // and must not be navigated to the game, which is what the normal bootstrap
  // would do with a stored session.
  const { pathname } = useLocation();
  const viewer = BOSS_ENABLED && isBrainPath(pathname);
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.
  useEffect(() => {
    if (viewer) return;
    useLobbyStore.getState().bind();
    useGameStore.getState().bind();
    useResultsStore.getState().bind();
    useChatStore.getState().bind();
  }, [viewer]);
  useSessionBootstrap(viewer);
  return null;
};

export const App = () => (
  <BrowserRouter>
    <Bootstrap />
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={PATHS.home} element={<HomePage />} />
        {/* BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
            No session guard: the brain tab is a viewer fed by the game tab,
            and claiming a session here would take the player's seat. */}
        {BOSS_ENABLED ? <Route path={PATHS.brain} element={<BossBrainPage />} /> : null}
        {/* BOSS-MODE — end. */}
        {/* Every room URL is an entry point: without a session for that room
            the guard renders the join view for the code in the address bar. */}
        <Route element={<RequireSession fallback={<RoomEntryPage />} />}>
          <Route path={PATHS.lobby} element={<LobbyPage />} />
          <Route path={PATHS.game} element={<GamePage />} />
          <Route path={PATHS.results} element={<ResultsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    <SessionReplacedOverlay />
  </BrowserRouter>
);
