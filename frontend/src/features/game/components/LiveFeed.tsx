import { useEffect, useRef } from 'react';

import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { FeedEvent } from '../models/game.model';

interface LiveFeedProps {
  t: Dictionary;
  feed: FeedEvent[];
}

const Body = ({ t, event }: { t: Dictionary; event: FeedEvent }) => {
  const name = <strong className="text-ink">{event.name}</strong>;
  switch (event.kind) {
    case 'solved':
      return (
        <span className="text-ink">
          {name} {t.game.feedSolved} · <strong className="text-red">{t.game.feedPenalty}</strong>
        </span>
      );
    case 'hint':
      return (
        <span>
          {name} {t.game.feedHint}
        </span>
      );
    case 'reaction':
      return (
        <span className="flex items-center gap-1.5">
          {name}
          <EmoteIcon emote={event.emote} size={18} className="text-ink" />
          <span className="sr-only">{t.emotes[event.emote]}</span>
        </span>
      );
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
  }
};

export const FeedRow = ({ t, event }: { t: Dictionary; event: FeedEvent }) => (
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

/** "Sala en vivo": chronological, auto-scrolls to the newest event. */
export const LiveFeed = ({ t, feed }: LiveFeedProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [feed.length]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <span className="label px-4 pt-3.5 pb-2">{t.game.liveFeed}</span>
      {feed.length === 0 ? (
        <p className="m-0 px-4 pb-4 text-[13px] text-ink-3">{t.game.feedEmpty}</p>
      ) : (
        <ul
          ref={listRef}
          className="m-0 flex min-h-0 list-none flex-col gap-0.5 overflow-y-auto p-0 px-2 pb-2"
          aria-live="polite"
        >
          {feed.map((event) => (
            <FeedRow key={event.id} t={t} event={event} />
          ))}
        </ul>
      )}
    </Card>
  );
};
