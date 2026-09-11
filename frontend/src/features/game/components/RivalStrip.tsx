import { Avatar } from '@/shared/components/ui/Avatar';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { ReactionBubble as ReactionBubbleModel, RivalViewModel } from '../models/game.model';
import { MiniBoard } from './MiniBoard';
import { ReactionBubble } from './ReactionBubble';

interface RivalStripProps {
  t: Dictionary;
  rivals: RivalViewModel[];
  rivalClocks: Record<string, number>;
  reactions: Record<string, ReactionBubbleModel>;
  lowTimeThreshold: number;
}

/** Phone layout: one column per rival (avatar, latest row, clock/position). */
export const RivalStrip = ({
  t,
  rivals,
  rivalClocks,
  reactions,
  lowTimeThreshold,
}: RivalStripProps) => (
  <ul className="m-0 flex list-none justify-between gap-1 overflow-x-auto rounded-xl border border-line bg-surface px-1.5 py-2.5">
    {rivals.map((rival) => {
      const seconds = rivalClocks[rival.id] ?? rival.secondsLeft;
      const low = rival.status === 'playing' && seconds < lowTimeThreshold;
      const reaction = reactions[rival.id];
      return (
        <li
          key={rival.id}
          className="flex w-11 shrink-0 flex-col items-center gap-1"
          title={rival.name}
        >
          <div className="relative">
            <Avatar name={rival.name} tone={rival.status === 'solved' ? 'green' : 'neutral'} />
            {reaction ? (
              <ReactionBubble
                key={reaction.stamp}
                size="sm"
                emote={reaction.emote}
                label={t.emotes[reaction.emote]}
              />
            ) : null}
          </div>
          <MiniBoard rows={rival.rows} size="xs" lastRowOnly />
          <span
            className={cn(
              'font-mono text-[10px] tabular-nums',
              rival.status === 'solved'
                ? 'font-bold text-green-ink'
                : low
                  ? 'font-bold text-red'
                  : 'text-ink-2',
            )}
          >
            {rival.status === 'solved'
              ? t.common.ordinal(rival.solvedPosition ?? 0)
              : rival.status === 'playing'
                ? formatClock(seconds, false)
                : '—'}
          </span>
        </li>
      );
    })}
  </ul>
);
