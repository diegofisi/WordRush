import { Fragment } from 'react';

import { Avatar } from '@/shared/components/ui/Avatar';
import { Card } from '@/shared/components/ui/Card';
import { SCORING } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { BreakdownRowViewModel } from '../models/results.model';

interface BreakdownTableProps {
  t: Dictionary;
  rows: BreakdownRowViewModel[];
}

const Num = ({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone?: 'pos' | 'neg' | 'mute';
  className?: string;
}) => (
  <span
    className={cn(
      'text-right font-mono font-semibold tabular-nums',
      tone === 'pos' && 'text-green-ink',
      tone === 'neg' && 'text-red',
      tone === 'mute' && 'font-medium text-faint',
      className,
    )}
  >
    {children}
  </span>
);

const Dot = () => <Num tone="mute">·</Num>;

const gridCols = 'grid-cols-[36px_160px_90px_90px_90px_80px_80px_90px]';

/** Per-round points table with the exact columns of Resultados.dc.html. */
export const BreakdownTable = ({ t, rows }: BreakdownTableProps) => {
  const firstUnsolved = rows.findIndex((row) => !row.solved);
  return (
    <Card className="overflow-x-auto">
      <div className="min-w-180" role="table">
        <div
          role="row"
          className={cn(
            'grid h-9 items-center gap-2 px-4 text-[11px] font-bold tracking-[0.08em] text-ink-3 uppercase',
            gridCols,
          )}
        >
          <span>#</span>
          <span>{t.results.colPlayer}</span>
          <span className="text-right">{t.results.colTime}</span>
          <span className="text-right">{t.results.colAttempts}</span>
          <span className="text-right">{t.results.colPosition}</span>
          <span className="text-right">{t.results.colHint}</span>
          <span className="text-right">{t.results.colGreens}</span>
          <span className="text-right">{t.results.colRound}</span>
        </div>
        <div className="h-px bg-line" />
        {rows.map((row, index) => (
          <Fragment key={row.playerId}>
            {index === firstUnsolved && index > 0 ? <div className="h-px bg-line" /> : null}
            <div
              role="row"
              className={cn(
                'grid h-11.5 items-center gap-2 px-4 text-sm',
                gridCols,
                row.solved && row.position === 1 && 'bg-green-soft',
                row.isMe && 'bg-accent-soft',
              )}
            >
              <span className={cn('font-mono font-bold', !row.solved && 'text-ink-3')}>
                {row.rank}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar
                  name={row.name}
                  size={28}
                  tone={row.isMe ? 'accent' : row.position === 1 ? 'green' : 'neutral'}
                />
                <span className="truncate font-semibold">{row.name}</span>
                {row.isMe ? (
                  <span className="text-[11px] font-bold text-accent">{t.common.you}</span>
                ) : null}
                {!row.solved ? (
                  <span className="text-[11px] text-ink-3">{t.results.notSolved}</span>
                ) : null}
              </span>
              {row.solved ? (
                <>
                  <Num>{row.timeLeftPercent ?? 0} %</Num>
                  {row.attemptPenalty !== 0 ? <Num tone="neg">{row.attemptPenalty}</Num> : <Dot />}
                  {row.positionBonus > 0 ? <Num tone="pos">+{row.positionBonus}</Num> : <Dot />}
                  {row.hintBonus > 0 ? (
                    <Num tone="pos">+{row.hintBonus}</Num>
                  ) : (
                    <Num tone="mute">{t.results.hintUsed}</Num>
                  )}
                  <Dot />
                </>
              ) : (
                <>
                  <Dot />
                  <Dot />
                  <Dot />
                  <Dot />
                  {row.greens > 0 ? (
                    <Num tone="pos">
                      {t.results.greensTimes(
                        Math.min(row.greens, SCORING.maxGreensUnsolved),
                        SCORING.pointsPerGreenUnsolved,
                      )}
                    </Num>
                  ) : (
                    <Num tone="mute">0</Num>
                  )}
                </>
              )}
              <Num className="text-base">
                {row.roundPoints}
                {row.floorApplied ? (
                  <span className="ml-1 text-[11px] font-medium text-ink-3">{t.results.floor}</span>
                ) : null}
              </Num>
            </div>
          </Fragment>
        ))}
      </div>
    </Card>
  );
};
