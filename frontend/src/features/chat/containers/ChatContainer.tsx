import { useEffect, useMemo, useState } from 'react';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import type { ChatChannel, TeamId } from '@/shared/contract';
import { useT } from '@/shared/i18n';
import { toast } from '@/shared/stores/useToastStore';

import { useSendChat } from '../api/send-chat/useSendChat';
import { ChatPanel } from '../components/ChatPanel';
import { toChatMessageViewModels } from '../models/chat.model';
import { useChatStore } from '../stores/useChatStore';

interface ChatContainerProps {
  teamMode: boolean;
  myTeam: TeamId | null;
  /** Whether "(Todos)" is open to me right now; the team channel always is. */
  canWriteAll: boolean;
  /** Shown in the composer while "(Todos)" is closed to me. */
  lockedReason?: string | null;
  bare?: boolean;
  className?: string;
}

/** The chat as the game and the results screens embed it; state lives in the chat store. */
export const ChatContainer = ({
  teamMode,
  myTeam,
  canWriteAll,
  lockedReason = null,
  bare = false,
  className,
}: ChatContainerProps) => {
  const t = useT();
  const messages = useChatStore((state) => state.messages);
  const myId = useSessionStore((state) => state.session?.playerId ?? null);
  const { sendChat, pending } = useSendChat();
  // Team mode opens on the team channel: that one is live from the first second.
  const [channel, setChannel] = useState<ChatChannel>(teamMode && myTeam ? 'team' : 'all');
  useEffect(() => {
    if (!teamMode || !myTeam) setChannel('all');
  }, [teamMode, myTeam]);

  const rows = useMemo(
    () => toChatMessageViewModels(messages, myId, myTeam),
    [messages, myId, myTeam],
  );
  const canWrite = channel === 'team' ? teamMode && myTeam !== null : canWriteAll;

  const send = async (text: string) => {
    const result = await sendChat(channel, text);
    if (result.ok) return;
    if (result.error.code === 'cooldown') toast.errorText(t.chat.tooFast);
    else toast.error(result.error.code);
  };

  return (
    <ChatPanel
      t={t}
      messages={rows}
      teamMode={teamMode && myTeam !== null}
      channel={channel}
      onChannel={setChannel}
      canWrite={canWrite}
      lockedReason={lockedReason}
      pending={pending}
      onSend={(text) => void send(text)}
      bare={bare}
      className={className}
    />
  );
};
