import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import { PageLoading } from '@/shared/components/ui/PageState';
import { ROOM_LIMITS } from '@/shared/contract';
import { useT } from '@/shared/i18n';
import { homeWithCode, PATHS, pathForStatus } from '@/shared/routes/paths';
import { toast } from '@/shared/stores/useToastStore';

import { useLeaveRoom } from '../api/leave-room/useLeaveRoom';
import { useSetReady } from '../api/set-ready/useSetReady';
import { useStartGame } from '../api/start-game/useStartGame';
import { LobbyActions } from '../components/LobbyActions';
import { PlayerSlots } from '../components/PlayerSlots';
import { RoomCodeHeader } from '../components/RoomCodeHeader';
import { ScoringCard } from '../components/ScoringCard';
import { useLobbyStore } from '../stores/useLobbyStore';

export const LobbyContainer = () => {
  const t = useT();
  const navigate = useNavigate();
  const lobby = useLobbyStore((state) => state.lobby);
  const session = useSessionStore((state) => state.session);
  const { setReady } = useSetReady();
  const { startGame, pending: starting } = useStartGame();
  const { leaveRoom } = useLeaveRoom();

  // Pushed transitions (round:start, or a lobby:update with a new status) move everyone along.
  useEffect(() => {
    if (lobby && lobby.status !== 'lobby') {
      navigate(pathForStatus(lobby.status, lobby.code), { replace: true });
    }
  }, [lobby, navigate]);

  if (!lobby || !session) return <PageLoading title={t.common.loading} />;

  const copyLink = async () => {
    const link = `${window.location.origin}${homeWithCode(lobby.code)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t.common.copied);
    } catch {
      toast.errorText(t.common.copyFailed);
    }
  };

  const toggleReady = async () => {
    const result = await setReady(!(lobby.me?.ready ?? false));
    if (!result.ok) toast.error(result.error.code);
  };

  const start = async () => {
    const result = await startGame();
    if (!result.ok) toast.error(result.error.code);
  };

  const leave = async () => {
    await leaveRoom();
    navigate(PATHS.home, { replace: true });
  };

  return (
    <div className="grid flex-1 grid-cols-1 gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-16 lg:py-9">
      <div className="flex flex-col gap-7">
        <RoomCodeHeader
          t={t}
          code={lobby.code}
          settings={lobby.settings}
          playerCount={lobby.playerCount}
          onCopyLink={() => void copyLink()}
        />
        <PlayerSlots t={t} players={lobby.players} capacity={lobby.settings.capacity} />
        <LobbyActions
          t={t}
          isHost={lobby.isHost}
          hostName={lobby.hostName}
          isReady={lobby.me?.ready ?? false}
          readyCount={lobby.readyCount}
          playerCount={lobby.playerCount}
          minPlayers={ROOM_LIMITS.minPlayers}
          starting={starting}
          onToggleReady={() => void toggleReady()}
          onStart={() => void start()}
          onLeave={() => void leave()}
        />
      </div>
      <ScoringCard t={t} />
    </div>
  );
};
