import { Avatar } from '@/shared/components/ui/Avatar';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { RivalViewModel } from '../models/game.model';
import { MiniBoard } from './MiniBoard';
import { PhraseSlots } from './PhraseSlots';

interface RivalStripProps {
  t: Dictionary;
  wordLength: number;
  rivals: RivalViewModel[];
  rivalClocks: Record<string, number>;
  lowTimeThreshold: number;
  /** Phrase game: the phrase as slots instead of the latest row. */
  phraseGame?: boolean;
}

/** Phone layout: one column per rival (avatar, latest row, clock/position). */
export const RivalStrip = ({
  t,
  wordLength,
  rivals,
  rivalClocks,
  lowTimeThreshold,
  phraseGame = false,
}: RivalStripProps) => (
  <ul className="m-0 flex list-none justify-between gap-1 overflow-x-auto rounded-xl border border-line bg-surface px-1.5 py-2.5">
    {rivals.map((rival) => {
      const seconds = rivalClocks[rival.id] ?? rival.secondsLeft;
      const low = rival.status === 'playing' && seconds < lowTimeThreshold;
      return (
        <li
          key={rival.id}
          className={cn('flex shrink-0 flex-col items-center gap-1', phraseGame ? 'w-20' : 'w-11')}
          title={rival.name}
        >
          <Avatar name={rival.name} tone={rival.status === 'solved' ? 'green' : 'neutral'} />
          {phraseGame && rival.phrase ? (
            <PhraseSlots
              mask={rival.phrase.mask}
              size="xs"
              labels={{ found: t.game.tileCorrect, unknown: t.game.phraseUnknown }}
            />
          ) : (
            <MiniBoard wordLength={wordLength} rows={rival.rows} size="xs" lastRowOnly />
          )}
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
