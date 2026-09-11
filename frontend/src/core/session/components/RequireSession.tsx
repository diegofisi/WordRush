import { Navigate, Outlet, useParams } from 'react-router-dom';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { PageLoading } from '@/shared/components/ui/PageState';
import { useT } from '@/shared/i18n';
import { homeWithCode, PATHS } from '@/shared/routes/paths';

/** Guards room routes: waits for bootstrap, then redirects home (code pre-filled) without a session. */
export const RequireSession = () => {
  const t = useT();
  const { code } = useParams<{ code: string }>();
  const session = useSessionStore((state) => state.session);
  const bootstrapped = useSessionStore((state) => state.bootstrapped);

  if (!bootstrapped) return <PageLoading title={t.common.connecting} />;
  if (!session) return <Navigate to={code ? homeWithCode(code) : PATHS.home} replace />;
  return <Outlet />;
};
