import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';

import type { RoundResultsViewModel } from '../models/results.model';

interface RoundHeaderProps {
  t: Dictionary;
  results: RoundResultsViewModel;
}

/** Word tiles + the "N of M solved it" line + my round / accumulated cards (Results.dc.html). */
export const RoundHeader = ({ t, results }: RoundHeaderProps) => {
  const missed = results.playerCount - results.solvedCount;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex gap-1.5" aria-label={results.word}>
          {[...results.word].map((letter, index) => (
            <span
              key={index}
              className="tile tile-green h-12 w-12 rounded-[9px] text-2xl animate-tile-flip"
              style={{ animationDelay: `${index * 110}ms` }}
            >
              {letter}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-0.5">
          {results.bossDefeated !== null ? (
            <span
              className={
                results.bossDefeated
                  ? 'w-fit rounded-full bg-green-soft px-3 py-1 text-xs font-bold text-green-ink'
                  : 'w-fit rounded-full bg-red-soft px-3 py-1 text-xs font-bold text-red'
              }
            >
              {results.bossDefeated ? t.results.bossBeaten : t.results.bossWon}
            </span>
          ) : null}
          <h2 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">
            {results.solvedCount > 0
              ? t.results.solvedCount(results.solvedCount, results.playerCount)
              : t.results.nobodySolved}
          </h2>
          <p className="m-0 text-sm text-ink-2">
            {results.first
              ? `${t.results.firstWas(results.first.name, results.first.timeLeftPercent ?? 0)} `
              : ''}
            {t.results.missedCount(missed)}
          </p>
          {results.boss ? (
            <p className="m-0 text-sm text-ink-2">
              {results.boss.solved
                ? t.results.bossSolvedIn(results.boss.attempts)
                : t.results.bossFellAfter(results.boss.attempts)}{' '}
              <span className="text-ink-3">{t.results.bossNoScore}</span>
            </p>
          ) : null}
          {results.bossDefeated && results.bossBonus > 0 ? (
            <p className="m-0 text-sm text-green-ink">
              {t.results.bossBonusNote(results.bossBonus)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2.5">
        <Card className="flex min-w-30 flex-col gap-0.5 px-4 py-3">
          <span className="label">{t.results.yourRound}</span>
          <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em]">
            {results.myRow?.roundPoints ?? 0}
          </span>
        </Card>
        <Card inverted className="flex min-w-30 flex-col gap-0.5 px-4 py-3">
          <span className="label text-tile-gray">{t.results.yourTotal}</span>
          <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em]">
            {results.myStanding?.total ?? 0}
          </span>
        </Card>
      </div>
    </div>
  );
};
