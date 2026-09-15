import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';

import { RequireSession } from '@/core/session/components/RequireSession';
import { SessionReplacedOverlay } from '@/core/session/components/SessionReplacedOverlay';
import { useSessionBootstrap } from '@/core/session/hooks/useSessionBootstrap';
import { sound } from '@/shared/lib/sound';
import { useGameStore } from '@/features/game/stores/useGameStore';
import { BossBrainPage } from '@/features/game/pages/BossBrainPage';
import { GamePage } from '@/features/game/pages/GamePage';
import { useLobbyStore } from '@/features/lobby/stores/useLobbyStore';
import { HomePage } from '@/features/lobby/pages/HomePage';
import { LobbyPage } from '@/features/lobby/pages/LobbyPage';
import { useResultsStore } from '@/features/results/stores/useResultsStore';
import { ResultsPage } from '@/features/results/pages/ResultsPage';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { Button } from '@/shared/components/ui/Button';
import { PageEmpty } from '@/shared/components/ui/PageState';
import { TopBar } from '@/shared/components/layout/TopBar';
import { useT } from '@/shared/i18n';
import { isBrainPath, PATHS } from '@/shared/routes/paths';

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

/**
 * Binds every socket-driven store once, then bootstraps the stored session.
 *
 * The brain tab opts out of all of it: it opens no socket, claims no session
 * and must not be navigated to the game, which is exactly what the normal
 * bootstrap would do with a stored session.
 */
const Bootstrap = () => {
  const viewer = isBrainPath(useLocation().pathname);

  // Browsers refuse to open an audio device until the page has been touched, so
  // the first click or key press opens it. Without this the round-start cue,
  // which nobody clicks for, would be swallowed.
  useEffect(() => {
    const open = () => sound.unlock();
    window.addEventListener('pointerdown', open, { once: true });
    window.addEventListener('keydown', open, { once: true });
    return () => {
      window.removeEventListener('pointerdown', open);
      window.removeEventListener('keydown', open);
    };
  }, []);

  useEffect(() => {
    if (viewer) return;
    useLobbyStore.getState().bind();
    useGameStore.getState().bind();
    useResultsStore.getState().bind();
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
        {/* No session guard: the brain tab is a viewer fed by the game tab,
            and claiming a session here would take the player's seat. */}
        <Route path={PATHS.brain} element={<BossBrainPage />} />
        <Route element={<RequireSession />}>
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
