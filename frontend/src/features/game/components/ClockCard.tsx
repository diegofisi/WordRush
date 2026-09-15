import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { GainChip } from '../models/game.model';
import type { ClockViewModel } from '../models/game-view.model';

interface ClockCardProps {
  t: Dictionary;
  title: string;
  clock: ClockViewModel;
  gains: GainChip[];
  /** "45 % de la frase completada · palabra 3 de 6". */
  caption: string;
}

/**
 * The clock as a side card (the phrase game's left column, and the team clock
 * in team mode): 44 px mono, bar, the seconds just gained.
 */
export const ClockCard = ({ t, title, clock, gains, caption }: ClockCardProps) => (
  <Card className="flex flex-col gap-2 px-4 pt-3.5 pb-3">
    <div className="flex items-center justify-between gap-2">
      <span className="label">{title}</span>
      <span className="text-xs text-ink-3">{t.game.timePct(clock.percent)}</span>
    </div>
    <div className="flex items-baseline gap-3">
      <span
        className={cn(
          'font-mono text-[44px] leading-none font-bold tracking-[-0.03em] tabular-nums',
          clock.low && 'text-red',
        )}
      >
        {formatClock(clock.secondsLeft)}
      </span>
      {gains[0] ? (
        <span className="font-mono text-[13px] font-bold text-green-ink" aria-live="polite">
          +{gains.reduce((sum, chip) => sum + chip.seconds, 0)} s
        </span>
      ) : null}
    </div>
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, clock.percent)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-200',
          clock.low ? 'bg-red' : clock.percent < 35 ? 'bg-yellow' : 'bg-green',
        )}
        style={{ width: `${Math.min(100, clock.percent)}%` }}
      />
    </div>
    <span className="text-[12px] text-ink-2">{caption}</span>
  </Card>
);
