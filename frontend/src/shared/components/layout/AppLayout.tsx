import { Outlet } from 'react-router-dom';

import { Toaster } from '@/shared/components/ui/Toaster';

/** Root shell: full-height column; pages render their own `TopBar`. */
export const AppLayout = () => (
  <div className="flex min-h-full flex-col bg-bg text-ink">
    <Outlet />
    <Toaster />
  </div>
);
