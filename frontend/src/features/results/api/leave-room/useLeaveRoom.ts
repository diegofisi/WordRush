import { useCallback } from 'react';

import { useSessionStore } from '@/core/session/stores/useSessionStore';

/** "Nueva partida": leave the finished room and forget the session. */
export const useLeaveRoom = () => {
  const leaveRoom = useCallback(() => useSessionStore.getState().leaveRoom(), []);
  return { leaveRoom };
};
