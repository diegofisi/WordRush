import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';

import { PageEmpty, PageLoading } from '@/shared/components/ui/PageState';
import { useT } from '@/shared/i18n';

import { useBossViewer } from '../hooks/useBossViewer';
import { SCOPE } from '../components/instrument/ScopePanels';

/** Three.js and the connectome sample only load on this route. */
const BossInstrument = lazy(() =>
  import('../components/instrument/BossInstrument').then((module) => ({
    default: module.BossInstrument,
  })),
);

/**
 * The fly's brain on its own tab.
 *
 * It is a viewer, not a player: it has no session and opens no socket, and
 * takes everything from the game tab over a BroadcastChannel
 * (`helpers/boss-channel.ts`). Open it, leave it on a second screen, and it
 * keeps measuring for as long as the game tab is alive.
 */
export const BossBrainPage = () => {
  const t = useT();
  const { code = '' } = useParams<{ code: string }>();
  const { boss, connected } = useBossViewer(code);

  return (
    <div
      className="flex min-h-dvh flex-col items-center gap-4 px-3 py-4 sm:px-5"
      style={{ background: SCOPE.bg, color: SCOPE.ink }}
    >
      <header className="flex w-full max-w-[1400px] flex-wrap items-baseline gap-3">
        <h1 className="m-0 font-display text-base font-extrabold">{t.boss.brainTitle}</h1>
        <span
          className="font-mono text-[10px] tracking-[0.1em] uppercase"
          style={{ color: SCOPE.ink3 }}
        >
          {code}
        </span>
        <span
          className="ml-auto font-mono text-[10px] tracking-[0.1em] uppercase"
          style={{ color: connected ? SCOPE.neural : SCOPE.ink3 }}
        >
          {connected ? t.boss.linkLive : t.boss.linkWaiting}
        </span>
      </header>

      {!connected ? (
        <PageEmpty title={t.boss.brainTitle} body={t.boss.linkHelp} />
      ) : !boss ? (
        <PageEmpty title={t.boss.brainTitle} body={t.boss.noBrain} />
      ) : (
        <Suspense fallback={<PageLoading title={t.common.connecting} />}>
          <BossInstrument t={t} boss={boss} />
        </Suspense>
      )}
    </div>
  );
};
