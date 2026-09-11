import { useCallback } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import type { EmptyOk } from '@/shared/lib/result';

/** Leaves the room and forgets the session regardless of the server's answer. */
export const useLeaveRoom = () => {
  const leaveRoom = useCallback(async () => {
    if (socket.connected) {
      await request<EmptyOk>((ack) => socket.emit('room:leave', ack), 3_000);
    }
    useSessionStore.getState().clearSession();
  }, []);
  return { leaveRoom };
};
