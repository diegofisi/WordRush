import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import type { GameKind } from '@/shared/contract';
import { TopBar } from '@/shared/components/layout/TopBar';
import { PageLoading } from '@/shared/components/ui/PageState';
import { useT } from '@/shared/i18n';
import { lobbyPath } from '@/shared/routes/paths';

// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
import { BOSS_ENABLED } from '@/features/boss/bossEnabled';
import { BossHomeOption } from '@/features/boss/components/BossHomeOption';
// BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.
import { GameSwitch } from '../components/GameSwitch';
import { Hero } from '../components/Hero';
import { SessionExpiredNotice } from '../components/SessionExpiredNotice';
import { ActiveGameContainer } from '../containers/ActiveGameContainer';
import { HomeContainer } from '../containers/HomeContainer';

export const HomePage = () => {
  const t = useT();
  const [searchParams] = useSearchParams();
  const session = useSessionStore((state) => state.session);
  const snapshot = useSessionStore((state) => state.snapshot);
  const bootstrapped = useSessionStore((state) => state.bootstrapped);
  const expired = useSessionStore((state) => state.expired);
  const dismissExpired = useSessionStore((state) => state.dismissExpired);
  // The game is the first choice on the page: picked on the hero, sent with the form.
  const [game, setGame] = useState<GameKind>('wordle');
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — start.
  // Her brain only knows the five-letter word race, so choosing her puts the
  // switch back on "Palabra" and the room on 5 letters, no teams.
  const [bossMode, setBossMode] = useState(false);
  const pickGame = (next: GameKind) => {
    setGame(next);
    if (next !== 'wordle') setBossMode(false);
  };
  const pickBoss = (next: boolean) => {
    setBossMode(next);
    if (next) setGame('wordle');
  };
  // BOSS-MODE (temporary; see docs/context/07-boss-removal.md) — end.
  const invitedCode = (searchParams.get('code') ?? '').trim().toUpperCase();

  // Old invitation links (`/?code=XXXX`) land on the canonical room URL, the
  // same one the address bar shows once inside the room.
  if (invitedCode) return <Navigate to={lobbyPath(invitedCode)} replace />;

  // One game at a time: a stored session that is still alive owns this screen.
  const activeGame = session && snapshot && snapshot.lobby.status !== 'finished' ? snapshot : null;

  if (session && !bootstrapped) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar bare />
        <PageLoading title={t.common.connecting} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        bare
        actions={
          <div className="flex items-center gap-2">
            <GameSwitch t={t.home} game={game} onChange={pickGame} />
            {/* BOSS-MODE (temporary; see docs/context/07-boss-removal.md) */}
            {BOSS_ENABLED ? (
              <BossHomeOption t={t} active={bossMode} onChange={pickBoss} />
            ) : null}
          </div>
        }
      />
      {expired ? (
        <SessionExpiredNotice
          message={t.common.sessionExpired}
          dismissLabel={t.common.dismiss}
          onDismiss={dismissExpired}
        />
      ) : null}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px]">
        <section className="flex flex-col justify-between gap-10 px-4 pt-4 pb-8 sm:px-8 lg:px-16 lg:pt-6 lg:pb-12">
          <Hero t={t.home} game={game} />
          <p className="m-0 text-[13px] text-ink-3">{t.home.footer}</p>
        </section>
        <section className="flex flex-col border-t border-line bg-surface px-4 py-8 sm:px-8 lg:border-t-0 lg:border-l lg:px-12 lg:py-10">
          {activeGame ? (
            <ActiveGameContainer snapshot={activeGame} />
          ) : (
            // BOSS-MODE (temporary; see docs/context/07-boss-removal.md): `bossMode`.
            <HomeContainer game={game} bossMode={BOSS_ENABLED && bossMode} />
          )}
        </section>
      </main>
    </div>
  );
};
