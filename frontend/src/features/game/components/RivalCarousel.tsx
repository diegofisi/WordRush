import { useEffect, useState } from 'react';

import { Avatar } from '@/shared/components/ui/Avatar';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { RivalViewModel } from '../models/game.model';
import { PhraseSlots } from './PhraseSlots';

interface RivalCarouselProps {
  t: Dictionary;
  rivals: RivalViewModel[];
  rivalClocks: Record<string, number>;
}

const ROTATE_MS = 4_000;

/**
 * Phone, phrase game: one rival at a time, rotating every few seconds — their
 * name (ellipsis when long) above their phrase as slots.
 */
export const RivalCarousel = ({ t, rivals, rivalClocks }: RivalCarouselProps) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (rivals.length <= 1) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % rivals.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [rivals.length]);
  const rival = rivals[index % Math.max(1, rivals.length)];
  if (!rival) return null;
  const seconds = rivalClocks[rival.id] ?? rival.secondsLeft;
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2"
      aria-live="off"
    >
      <Avatar name={rival.name} size={30} tone={rival.status === 'solved' ? 'green' : 'neutral'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{rival.name}</span>
          <span
            className={cn(
              'font-mono text-[11px] font-bold tabular-nums',
              rival.status === 'solved' ? 'text-green-ink' : 'text-ink-2',
            )}
          >
            {rival.status === 'solved'
              ? t.common.ordinal(rival.solvedPosition ?? 0)
              : rival.status === 'playing'
                ? formatClock(seconds, false)
                : '—'}
          </span>
        </div>
        {rival.phrase ? (
          <PhraseSlots
            mask={rival.phrase.mask}
            size="xs"
            labels={{ found: t.game.tileCorrect, unknown: t.game.phraseUnknown }}
          />
        ) : null}
      </div>
      {rivals.length > 1 ? (
        <span className="font-mono text-[10px] text-ink-3 tabular-nums">
          {index + 1}/{rivals.length}
        </span>
      ) : null}
    </div>
  );
};
