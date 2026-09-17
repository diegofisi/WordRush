import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { StickerGroup } from '../helpers/roomStream';
import type { TextFeedEvent } from '../models/game.model';

/** Art size of a sticker message inside the chat panel. */
const STICKER_SIZE = 112;

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
    case 'out-of-sends':
      return (
        <span>
          {name} {t.game.feedOutOfSends}
        </span>
      );
    case 'joined':
      return (
        <span>
          {name} {t.game.feedJoined}
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
    case 'phrase-completed':
      return (
        <span className="text-ink">
          {name} {t.game.feedPhraseCompleted} ·{' '}
          <strong className="text-red">{t.game.feedPenalty}</strong>
        </span>
      );
    case 'phrase-missed':
      return (
        <span>
          {name} {t.game.feedPhraseMissed}
        </span>
      );
    case 'team-finished':
      return (
        <span>
          <strong className="text-ink">{event.teamName}</strong>{' '}
          {event.reason === 'time'
            ? t.game.feedTeamOutOfTime
            : event.reason === 'sends'
              ? t.game.feedTeamOutOfSends
              : t.game.feedTeamOutOfAttempts}
        </span>
      );
  }
};

/** A one-line event (solved, penalty, hint, joined, left...) inside the stream. */
export const FeedRow = ({ t, event }: { t: Dictionary; event: TextFeedEvent }) => (
  <li
    className={cn(
      'flex gap-2.5 rounded-[10px] p-2 text-[13px] leading-[1.4] text-ink-2',
      (event.kind === 'solved' || event.kind === 'phrase-completed') && 'bg-red-soft',
    )}
  >
    <span
      className={cn(
        'shrink-0 pt-0.5 font-mono text-xs tabular-nums',
        event.kind === 'solved' || event.kind === 'phrase-completed' ? 'text-red' : 'text-ink-3',
      )}
    >
      {formatClock(event.atSeconds, false)}
    </span>
    <Body t={t} event={event} />
  </li>
);

/** A sticker message: the stickers one player sent in a row, under one header. */
export const StickerMessage = ({ t, group }: { t: Dictionary; group: StickerGroup }) => (
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
          />
        ))}
      </span>
    </span>
  </li>
);
