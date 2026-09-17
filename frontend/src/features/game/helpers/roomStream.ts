import type { Emote } from '@/shared/contract';

import type { FeedEvent, TextFeedEvent } from '../models/game.model';

/** Consecutive stickers from the same player inside this window share a header. */
const STICKER_GROUP_SECONDS = 10;

export interface StickerGroup {
  /** Key and header time come from the first sticker of the group. */
  id: number;
  /** Epoch ms of the first sticker: where the group sits in the stream. */
  at: number;
  playerId: string;
  name: string;
  atSeconds: number;
  /** Seconds of the newest sticker, to decide whether the next one stacks. */
  lastAt: number;
  stickers: { id: number; emote: Emote }[];
}

export type RoomStreamItem =
  | { kind: 'text'; id: number; at: number; event: TextFeedEvent }
  | { kind: 'stickers'; id: number; at: number; group: StickerGroup };

/**
 * The round's events as the merged chat panel takes them
 * (docs/context/06-v1.1.md -> Chat): one item per system line, and stickers
 * grouped the way a chat groups consecutive messages from the same person.
 */
export const groupRoomStream = (feed: FeedEvent[]): RoomStreamItem[] => {
  const items: RoomStreamItem[] = [];
  for (const event of feed) {
    if (event.kind !== 'reaction') {
      items.push({ kind: 'text', id: event.id, at: event.at, event });
      continue;
    }
    const previous = items[items.length - 1];
    if (
      previous?.kind === 'stickers' &&
      previous.group.playerId === event.playerId &&
      event.atSeconds - previous.group.lastAt <= STICKER_GROUP_SECONDS
    ) {
      previous.group.stickers.push({ id: event.id, emote: event.emote });
      previous.group.lastAt = event.atSeconds;
      continue;
    }
    items.push({
      kind: 'stickers',
      id: event.id,
      at: event.at,
      group: {
        id: event.id,
        at: event.at,
        playerId: event.playerId,
        name: event.name,
        atSeconds: event.atSeconds,
        lastAt: event.atSeconds,
        stickers: [{ id: event.id, emote: event.emote }],
      },
    });
  }
  return items;
};
