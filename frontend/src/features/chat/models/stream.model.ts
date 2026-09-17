import type { ReactNode } from 'react';

import type { ChatMessageViewModel } from './chat.model';

/**
 * A room event (somebody solved, a penalty, a hint, an arrival, a sticker) as
 * the merged panel takes it. The slice that owns the event renders it — the
 * game's feed knows its own wording and colours — and the chat only places it
 * in time order (docs/context/06-v1.1.md -> Chat).
 */
export interface ChatStreamEvent {
  id: number;
  /** Epoch ms; what the whole stream is sorted by. */
  at: number;
  /** An `<li>`, rendered as is inside the message list. */
  node: ReactNode;
}

export type ChatStreamItem =
  | { kind: 'message'; at: number; message: ChatMessageViewModel }
  | { kind: 'event'; at: number; event: ChatStreamEvent };

/**
 * One stream: system events, stickers and text messages in the order they
 * happened. Messages keep their own order on a tie, so a burst that shares a
 * millisecond never shuffles.
 */
export const toStream = (
  messages: ChatMessageViewModel[],
  events: ChatStreamEvent[],
): ChatStreamItem[] => {
  const items: ChatStreamItem[] = [
    ...messages.map((message): ChatStreamItem => ({ kind: 'message', at: message.at, message })),
    ...events.map((event): ChatStreamItem => ({ kind: 'event', at: event.at, event })),
  ];
  return items
    .map((item, index) => ({ item, index }))
    .sort((first, second) => first.item.at - second.item.at || first.index - second.index)
    .map((entry) => entry.item);
};
