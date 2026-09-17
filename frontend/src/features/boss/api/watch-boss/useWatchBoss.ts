import { useEffect } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import type { EmptyOk } from '@/shared/lib/result';

/**
 * Tells the server somebody has her brain panel open. Streaming the simulation
 * costs a worker thread real CPU, so it only runs while it is being watched
 * (docs/context/08-boss-mode.md).
 */
export const useWatchBoss = (watching: boolean): void => {
  useEffect(() => {
    const send = (value: boolean) => {
      void request<EmptyOk>((ack) => socket.emit('boss:watch', { watching: value }, ack));
    };
    send(watching);
    if (!watching) return;
    // A reconnect loses the subscription; ask again on the way back. The
    // listener is removed by reference: `socket.off('connect')` with no handler
    // would take the session layer's own reconnect listeners with it.
    const again = () => send(true);
    socket.on('connect', again);
    return () => {
      socket.off('connect', again);
      send(false);
    };
  }, [watching]);
};
