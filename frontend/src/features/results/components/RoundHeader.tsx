import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';
import { teamLabel } from '@/shared/lib/teamColor';

import type { RoundResultsViewModel } from '../models/results.model';

interface RoundHeaderProps {
  t: Dictionary;
  results: RoundResultsViewModel;
}

/** Word tiles + the "N of M solved it" line + my round / accumulated cards (Results.dc.html). */
export const RoundHeader = ({ t, results }: RoundHeaderProps) => {
  const missed = results.playerCount - results.solvedCount;
  const teamMode = results.mode === 'teams';
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
          <h2 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">
            {teamMode
              ? results.solvedCount > 0
                ? t.results.teamsSolvedCount(results.solvedCount, results.playerCount)
                : t.results.noTeamSolved
              : results.solvedCount > 0
                ? t.results.solvedCount(results.solvedCount, results.playerCount)
                : t.results.nobodySolved}
          </h2>
          <p className="m-0 text-sm text-ink-2">
            {teamMode
              ? results.firstTeam
                ? t.results.teamFirstWas(
                    teamLabel(t, { id: results.firstTeam.team, name: results.firstTeam.name }),
                    results.firstTeam.timeLeftPercent ?? 0,
                  )
                : ''
              : `${
                  results.first
                    ? `${t.results.firstWas(results.first.name, results.first.timeLeftPercent ?? 0)} `
                    : ''
                }${t.results.missedCount(missed)}`}
          </p>
        </div>
      </div>
      <div className="flex gap-2.5">
        <Card className="flex min-w-30 flex-col gap-0.5 px-4 py-3">
          <span className="label">{teamMode ? t.results.teamRound : t.results.yourRound}</span>
          <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em]">
            {results.myRoundPoints}
          </span>
        </Card>
        <Card inverted className="flex min-w-30 flex-col gap-0.5 px-4 py-3">
          <span className="label text-tile-gray">
            {teamMode ? t.results.teamTotal : t.results.yourTotal}
          </span>
          <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em]">
            {results.myTotal}
          </span>
        </Card>
      </div>
    </div>
  );
};
