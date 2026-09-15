import { useCallback, useEffect, useRef } from 'react';

import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import { Card } from '@/shared/components/ui/Card';
import type { Emote } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { FeedEvent, TextFeedEvent } from '../models/game.model';

interface LiveFeedProps {
  t: Dictionary;
  feed: FeedEvent[];
}

/** Art size of a sticker message in the desktop right column. */
const STICKER_SIZE = 112;

/** Consecutive stickers from the same player inside this window share a header. */
const STICKER_GROUP_SECONDS = 10;

const Body = ({ t, event }: { t: Dictionary; event: TextFeedEvent }) => {
  const name = <strong className="text-ink">{event.name}</strong>;
  switch (event.kind) {
    case 'solved':
      return (
        <span className="text-ink">
          {name} {t.game.feedSolved} · <strong className="text-red">{t.game.feedPenalty}</strong>
        </span>
      );
    case 'hint':
      return <span className="text-ink-2">{t.game.feedHint}</span>;
    case 'greens':
      return (
        <span>
          {name} {t.game.feedGreens(event.greens)}
        </span>
      );
    case 'low-time':
      return (
        <span>
          {name} {t.game.feedLowTime}
        </span>
      );
    case 'out-of-attempts':
      return (
        <span>
          {name} {t.game.feedOutOfAttempts}
        </span>
      );
    case 'out-of-time':
      return (
        <span>
          {name} {t.game.feedOutOfTime}
        </span>
      );
    case 'left':
      return (
        <span>
          {name} {t.game.feedLeft}
        </span>
      );
    case 'new-host':
      return (
        <span>
          {name} {t.game.feedNewHost}
        </span>
      );
    case 'team-finished':
      return (
        <span>
          <strong className="text-ink">{event.teamName}</strong>{' '}
          {event.reason === 'time' ? t.game.feedTeamOutOfTime : t.game.feedTeamOutOfAttempts}
        </span>
      );
  }
};

/** A one-line event (solved, penalty, hint, left...). Stickers get their own block. */
export const FeedRow = ({ t, event }: { t: Dictionary; event: TextFeedEvent }) => (
  <li
    className={cn(
      'flex gap-2.5 rounded-[10px] p-2 text-[13px] leading-[1.4] text-ink-2',
      event.kind === 'solved' && 'bg-red-soft',
    )}
  >
    <span
      className={cn(
        'shrink-0 pt-0.5 font-mono text-xs tabular-nums',
        event.kind === 'solved' ? 'text-red' : 'text-ink-3',
      )}
    >
      {formatClock(event.atSeconds, false)}
    </span>
    <Body t={t} event={event} />
  </li>
);

interface StickerGroup {
  kind: 'stickers';
  /** Key and header time come from the first sticker of the group. */
  id: number;
  playerId: string;
  name: string;
  atSeconds: number;
  /** Time of the newest sticker, to decide whether the next one still stacks. */
  lastAt: number;
  stickers: { id: number; emote: Emote }[];
}

type FeedItem = { kind: 'text'; event: TextFeedEvent } | StickerGroup;

/**
 * Stickers are messages, not one-liners: several in a row from the same player
 * inside `STICKER_GROUP_SECONDS` stack under a single "time + name" header, the
 * way a chat groups consecutive messages.
 */
const groupFeed = (feed: FeedEvent[]): FeedItem[] => {
  const items: FeedItem[] = [];
  for (const event of feed) {
    if (event.kind !== 'reaction') {
      items.push({ kind: 'text', event });
      continue;
    }
    const last = items[items.length - 1];
    if (
      last?.kind === 'stickers' &&
      last.playerId === event.playerId &&
      event.atSeconds - last.lastAt <= STICKER_GROUP_SECONDS
    ) {
      last.stickers.push({ id: event.id, emote: event.emote });
      last.lastAt = event.atSeconds;
      continue;
    }
    items.push({
      kind: 'stickers',
      id: event.id,
      playerId: event.playerId,
      name: event.name,
      atSeconds: event.atSeconds,
      lastAt: event.atSeconds,
      stickers: [{ id: event.id, emote: event.emote }],
    });
  }
  return items;
};

const StickerMessage = ({
  t,
  group,
  onArtLoad,
}: {
  t: Dictionary;
  group: StickerGroup;
  onArtLoad: () => void;
}) => (
  <li className="flex gap-2.5 rounded-[10px] p-2 text-[13px] leading-[1.4] text-ink-2">
    <span className="shrink-0 pt-0.5 font-mono text-xs tabular-nums text-ink-3">
      {formatClock(group.atSeconds, false)}
    </span>
    <span className="flex min-w-0 flex-col gap-1.5">
      <strong className="text-ink">{group.name}</strong>
      <span className="flex flex-wrap gap-1.5">
        {group.stickers.map((sticker) => (
          <EmoteIcon
            key={sticker.id}
            emote={sticker.emote}
            size={STICKER_SIZE}
            label={t.emotes[sticker.emote]}
            onLoad={onArtLoad}
          />
        ))}
      </span>
    </span>
  </li>
);

/** "Sala en vivo": chronological, auto-scrolls to the newest item, scrolls inside the card. */
export const LiveFeed = ({ t, feed }: LiveFeedProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const toEnd = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);
  // Sticker art arrives after the render that added it, so the image also
  // re-scrolls once it is painted; otherwise the feed stops one message short.
  useEffect(toEnd, [feed.length, toEnd]);

  const items = groupFeed(feed);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <span className="label px-4 pt-3.5 pb-2">{t.game.liveFeed}</span>
      {items.length === 0 ? (
        <p className="m-0 px-4 pb-4 text-[13px] text-ink-3">{t.game.feedEmpty}</p>
      ) : (
        <ul
          ref={listRef}
          className="m-0 flex min-h-0 list-none flex-col gap-0.5 overflow-y-auto p-0 px-2 pb-2"
          aria-live="polite"
        >
          {items.map((item) =>
            item.kind === 'text' ? (
              <FeedRow key={item.event.id} t={t} event={item.event} />
            ) : (
              <StickerMessage key={item.id} t={t} group={item} onArtLoad={toEnd} />
            ),
          )}
        </ul>
      )}
    </Card>
  );
};
