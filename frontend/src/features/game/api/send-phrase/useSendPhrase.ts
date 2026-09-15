import { useCallback, useRef, useState } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import type { PhraseAck } from '@/shared/contract';
import type { Result } from '@/shared/lib/result';

import { useGameStore } from '../../stores/useGameStore';

/** Emits `game:phrase`; on success the ack is applied to the game store (sends, clock, solve). */
export const useSendPhrase = () => {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const sendPhrase = useCallback(async (text: string): Promise<Result<PhraseAck> | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await request<PhraseAck>((ack) =>
        socket.emit('game:phrase', { text: text.trim() }, ack),
      );
      if (result.ok) useGameStore.getState().applyPhraseAck(result.value);
      return result;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return { sendPhrase, pending };
};
