import { useCallback, useState } from 'react';

import { request, socket } from '@/core/session/lib/socket';
import type { TeamColor, TeamId } from '@/shared/contract';
import type { EmptyOk, Result } from '@/shared/lib/result';

/**
 * The four team actions of the lobby (docs/context/06-v1.1.md -> Teams). Every
 * one answers with an empty ack; the slots redraw from the `lobby:update`
 * that follows, never from a local guess.
 */
export const useTeamActions = () => {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (
      emit: (
        ack: Parameters<typeof request<EmptyOk>>[0] extends (a: infer A) => void ? A : never,
      ) => void,
    ): Promise<Result<EmptyOk>> => {
      setPending(true);
      try {
        return await request<EmptyOk>(emit);
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const joinTeam = useCallback(
    (team: TeamId) => run((ack) => socket.emit('team:join', { team }, ack)),
    [run],
  );
  const assignTeam = useCallback(
    (playerId: string, team: TeamId) =>
      run((ack) => socket.emit('team:assign', { playerId, team }, ack)),
    [run],
  );
  const customizeTeam = useCallback(
    (team: TeamId, patch: { name?: string; color?: TeamColor }) =>
      run((ack) => socket.emit('team:customize', { team, ...patch }, ack)),
    [run],
  );
  const resetGames = useCallback(() => run((ack) => socket.emit('team:reset-games', ack)), [run]);

  return { joinTeam, assignTeam, customizeTeam, resetGames, pending };
};
