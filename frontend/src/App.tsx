import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

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
  useEffect(() => {
    useLobbyStore.getState().bind();
    useGameStore.getState().bind();
    useResultsStore.getState().bind();
    useChatStore.getState().bind();
  }, []);
  useSessionBootstrap();
  return null;
};

export const App = () => (
  <BrowserRouter>
    <Bootstrap />
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={PATHS.home} element={<HomePage />} />
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
