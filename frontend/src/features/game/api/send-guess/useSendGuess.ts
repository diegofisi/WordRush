import { useCallback, useRef, useState } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import type { Result } from '@/shared/lib/result';

import { useGameStore } from '../../stores/useGameStore';
import { toSendGuessRequest, type SendGuessResponse } from './send-guess.dto';

/** Emits `game:guess`; on success the ack is applied to the game store (rows, clock, gains). */
export const useSendGuess = () => {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const sendGuess = useCallback(async (word: string): Promise<Result<SendGuessResponse> | null> => {
    if (inFlight.current) return null; // single-flight: Enter mashing must not double-submit
    inFlight.current = true;
    setPending(true);
    try {
      const result = await request<SendGuessResponse>((ack) =>
        socket.emit('game:guess', toSendGuessRequest(word), ack),
      );
      if (result.ok) useGameStore.getState().applyGuessAck(result.value, word);
      return result;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return { sendGuess, pending };
};
