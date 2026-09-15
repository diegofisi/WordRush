import { useCallback, useState } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import type { EmptyOk, Result } from '@/shared/lib/result';

/** An observer asks for (or gives up) a seat; the lobby redraws from `lobby:update`. */
export const useSitObserver = () => {
  const [pending, setPending] = useState(false);

  const sit = useCallback(async (wants: boolean): Promise<Result<EmptyOk>> => {
    setPending(true);
    try {
      return await request<EmptyOk>((ack) => socket.emit('observer:sit', { wants }, ack));
    } finally {
      setPending(false);
    }
  }, []);

  return { sit, pending };
};
