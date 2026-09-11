import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { GainChip } from '../models/game.model';
import type { ClockViewModel } from '../models/game-view.model';

interface ClockProps {
  clock: ClockViewModel;
  caption: string;
  gains: GainChip[];
  gainLabel: (chip: GainChip) => string;
  compact?: boolean;
}

const barColor = (clock: ClockViewModel) =>
  clock.low ? 'bg-red' : clock.percent < 35 ? 'bg-yellow' : 'bg-green';

export const Clock = ({ clock, caption, gains, gainLabel, compact = false }: ClockProps) => {
  const time = formatClock(clock.secondsLeft);
  if (compact) {
    return (
      <div className="flex items-baseline gap-2.5">
        <span
          className={cn(
            'font-mono text-[40px] leading-none font-bold tracking-[-0.03em] tabular-nums',
            clock.low && 'text-red',
          )}
          aria-live="off"
        >
          {time}
        </span>
        {gains[0] ? (
          <span className="font-mono text-[13px] font-bold text-green-ink">
            +{gains.reduce((sum, chip) => sum + chip.seconds, 0)} s
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-7 gap-y-3">
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            'font-mono text-[56px] leading-none font-bold tracking-[-0.03em] tabular-nums lg:text-[64px]',
            clock.low && 'text-red',
          )}
        >
          {time}
        </span>
        <div
          className="mt-2 h-1.5 w-55 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, clock.percent)}
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-200', barColor(clock))}
            style={{ width: `${Math.min(100, clock.percent)}%` }}
          />
        </div>
        <span className="mt-1 text-[13px] text-ink-2">{caption}</span>
      </div>
      {gains.length > 0 ? (
        <div className="flex flex-col gap-1.5 pb-5.5" aria-live="polite">
          {gains.map((chip) => (
            <span
              key={chip.id}
              className="flex h-7 items-center gap-1.5 rounded-full bg-green-soft px-2.5 text-[13px] font-bold text-green-ink animate-fade-in"
            >
              <span className="font-mono">+{chip.seconds} s</span>
              <span className="font-medium">{gainLabel(chip)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
