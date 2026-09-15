import type { ChatChannel, ChatMessage, TeamId } from '@/shared/contract';

export interface ChatMessageViewModel {
  id: number;
  round: number;
  name: string;
  text: string;
  channel: ChatChannel;
  /** Sent by an observer: labelled as such. */
  observer: boolean;
  isMe: boolean;
  /** Team mode: the sender sits in my team. */
  isTeammate: boolean;
  /** `hh:mm` local time. */
  time: string;
  /** First message of a new round: the list prints a divider before it. */
  startsRound: boolean;
}

const formatTime = (at: number) => {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const toChatMessageViewModels = (
  messages: ChatMessage[],
  myId: string | null,
  myTeam: TeamId | null,
): ChatMessageViewModel[] =>
  messages.map((message, index) => ({
    id: message.id,
    round: message.round,
    name: message.name,
    text: message.text,
    channel: message.channel,
    observer: message.observer,
    isMe: message.playerId === myId,
    isTeammate: myTeam !== null && message.team === myTeam,
    time: formatTime(message.at),
    startsRound: index === 0 ? message.round > 0 : messages[index - 1]?.round !== message.round,
  }));
