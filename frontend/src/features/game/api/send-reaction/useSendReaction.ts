import { useCallback } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import type { Emote } from '@/shared/contract';
import type { EmptyOk, Result } from '@/shared/lib/result';

export const useSendReaction = () => {
  const sendReaction = useCallback(
    (emote: Emote): Promise<Result<EmptyOk>> =>
      request<EmptyOk>((ack) => socket.emit('reaction:send', { emote }, ack)),
    [],
  );
  return { sendReaction };
};
