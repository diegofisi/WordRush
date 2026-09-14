import type { BossSummary } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

interface BossRowsProps {
  t: Dictionary;
  boss: BossSummary;
}

/**
 * Every word the fly played, with its colours. Only ever rendered on the round
 * summary: while the round runs nobody sees a letter of hers
 * (docs/context/06-boss-mode.md).
 */
export const BossRows = ({ t, boss }: BossRowsProps) => {
  if (boss.rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <span className="label">{t.results.bossWords}</span>
        <span className="text-xs text-ink-3">
          {boss.solved ? t.results.bossSolvedIn(boss.attempts) : t.results.bossFellAfter(boss.attempts)}
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {boss.rows.map((row, index) => (
          <li key={`${row.word}-${index}`} className="flex items-center gap-2.5">
            <span className="w-4 text-right font-mono text-xs text-ink-3 tabular-nums">
              {index + 1}
            </span>
            <div className="flex gap-1">
              {[...row.word].map((letter, position) => (
                <span
                  key={position}
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded font-display text-sm font-bold',
                    row.colors[position] === 'green' && 'bg-green text-white',
                    row.colors[position] === 'yellow' && 'bg-yellow text-tile-ink-dark',
                    row.colors[position] === 'gray' && 'bg-tile-gray text-tile-gray-ink',
                  )}
                >
                  {letter.toUpperCase()}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
