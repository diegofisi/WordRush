import { useCallback, useState } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import { useSessionStore } from '@/core/session/stores/useSessionStore';
import type { Result } from '@/shared/lib/result';

import {
  toCreateRoomRequest,
  type CreateRoomForm,
  type CreateRoomResponse,
} from './create-room.dto';

export const useCreateRoom = () => {
  const [pending, setPending] = useState(false);

  const createRoom = useCallback(
    async (form: CreateRoomForm): Promise<Result<{ roomCode: string }>> => {
      setPending(true);
      try {
        const result = await request<CreateRoomResponse>((ack) =>
          socket.emit('room:create', toCreateRoomRequest(form), ack),
        );
        if (!result.ok) return result;
        useSessionStore.getState().applyAck(result.value, form.name.trim());
        return { ok: true, value: { roomCode: result.value.roomCode } };
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { createRoom, pending };
};
