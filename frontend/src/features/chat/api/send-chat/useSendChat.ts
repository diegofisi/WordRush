import { useCallback, useRef, useState } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import { ROOM_LIMITS, type ChatChannel } from '@/shared/contract';
import { fail, type EmptyOk, type Result } from '@/shared/lib/result';

const INTERVAL_MS = ROOM_LIMITS.chatIntervalSeconds * 1000;

/** One message per second, refused locally first so the server rarely has to. */
export const useSendChat = () => {
  const [pending, setPending] = useState(false);
  const lastSentAt = useRef(0);

  const sendChat = useCallback(
    async (channel: ChatChannel, text: string): Promise<Result<EmptyOk>> => {
      const now = Date.now();
      if (now - lastSentAt.current < INTERVAL_MS) {
        return fail({ code: 'cooldown', message: 'Too fast, wait a moment' });
      }
      lastSentAt.current = now;
      setPending(true);
      try {
        return await request<EmptyOk>((ack) => socket.emit('chat:send', { channel, text }, ack));
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { sendChat, pending };
};
