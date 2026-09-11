import { useCallback, useState } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import type { Result } from '@/shared/lib/result';

import { useGameStore } from '../../stores/useGameStore';
import type { UseHintResponse } from './use-hint.dto';

export const useUseHint = () => {
  const [pending, setPending] = useState(false);

  const requestHint = useCallback(async (): Promise<Result<UseHintResponse>> => {
    setPending(true);
    try {
      const result = await request<UseHintResponse>((ack) => socket.emit('game:hint', ack));
      if (result.ok) useGameStore.getState().applyHintAck(result.value);
      return result;
    } finally {
      setPending(false);
    }
  }, []);

  return { requestHint, pending };
};
