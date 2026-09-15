import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { paintFor, teamLabel } from '@/shared/lib/teamColor';

import type { TeamStandingViewModel } from '../models/results.model';

interface TeamStandingsListProps {
  t: Dictionary;
  standings: TeamStandingViewModel[];
  title: string;
  subtitle: string;
}

/** Team mode "Acumulado": one bar per team in its colour, rounds and games won under it. */
export const TeamStandingsList = ({ t, standings, title, subtitle }: TeamStandingsListProps) => (
  <Card className="flex min-h-0 flex-col gap-1 px-5 pt-5 pb-4">
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="m-0 font-display text-[22px] font-bold tracking-[-0.02em]">{title}</h3>
      <span className="text-xs text-ink-3">{subtitle}</span>
    </div>
    <ol className="m-0 flex list-none flex-col p-0">
      {standings.map((standing) => {
        const paint = paintFor(standing.color);
        return (
          <li key={standing.team} className="flex flex-col gap-1.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-3.5 font-mono text-xs text-ink-3">{standing.rank}</span>
                <span className={cn('truncate font-semibold', paint.text)}>
                  {teamLabel(t, { id: standing.team, name: standing.name })}
                </span>
                {standing.isMine ? (
                  <span className="text-[11px] font-bold text-accent">{t.lobby.yourTeam}</span>
                ) : null}
              </div>
              <span className="font-mono font-bold tabular-nums">{standing.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-track">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500', paint.bg)}
                style={{ width: `${standing.barPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-ink-3">
              {t.results.roundsWonCount(standing.roundsWon)} ·{' '}
              {t.results.gamesWonCount(standing.gamesWon)}
            </span>
          </li>
        );
      })}
    </ol>
    <p className="m-0 mt-auto border-t border-line pt-3 text-xs leading-[1.45] text-ink-3">
      {t.results.tiebreakTeams}
    </p>
  </Card>
);
