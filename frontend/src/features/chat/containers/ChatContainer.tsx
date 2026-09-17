import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSessionStore } from '@/core/session/stores/useSessionStore';
import type { ChatChannel, TeamId } from '@/shared/contract';
import { useT } from '@/shared/i18n';
import { toast } from '@/shared/stores/useToastStore';

import { useSendChat } from '../api/send-chat/useSendChat';
import { ChatPanel } from '../components/ChatPanel';
import { toChatMessageViewModels } from '../models/chat.model';
import type { ChatStreamEvent } from '../models/stream.model';
import { useChatStore } from '../stores/useChatStore';

interface ChatContainerProps {
  teamMode: boolean;
  myTeam: TeamId | null;
  /** Whether "(Todos)" is open to me right now; the team channel always is. */
  canWriteAll: boolean;
  /** Shown in the composer while "(Todos)" is closed to me. */
  lockedReason?: string | null;
  /** The room's events, already rendered by the slice that owns them. */
  events?: ChatStreamEvent[];
  /**
   * Whether text has two channels right now: team mode **during the round**.
   * Between rounds everybody talks in "(Todos)" and the switch is hidden.
   */
  channels?: boolean;
  /** The sticker picker's trigger, placed next to the composer. */
  sticker?: ReactNode;
  bare?: boolean;
  className?: string;
}

/** The chat as the game and the results screens embed it; state lives in the chat store. */
export const ChatContainer = ({
  teamMode,
  myTeam,
  canWriteAll,
  lockedReason = null,
  events = [],
  channels = false,
  sticker,
  bare = false,
  className,
}: ChatContainerProps) => {
  const t = useT();
  const messages = useChatStore((state) => state.messages);
  const myId = useSessionStore((state) => state.session?.playerId ?? null);
  const { sendChat, pending } = useSendChat();
  const hasChannels = channels && teamMode && myTeam !== null;
  // Team mode opens on the team channel: that one is live from the first second.
  const [channel, setChannel] = useState<ChatChannel>(hasChannels ? 'team' : 'all');
  useEffect(() => {
    if (!hasChannels) setChannel('all');
  }, [hasChannels]);

  const rows = useMemo(
    () => toChatMessageViewModels(messages, myId, myTeam),
    [messages, myId, myTeam],
  );
  const canWrite = channel === 'team' ? hasChannels : canWriteAll;

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
      events={events}
      channels={hasChannels}
      channel={channel}
      onChannel={setChannel}
      canWrite={canWrite}
      lockedReason={lockedReason}
      pending={pending}
      onSend={(text) => void send(text)}
      sticker={sticker}
      bare={bare}
      className={className}
    />
  );
};
