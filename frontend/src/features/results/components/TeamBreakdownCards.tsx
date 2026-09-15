import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { paintFor, teamLabel } from '@/shared/lib/teamColor';

import type { TeamBreakdownViewModel } from '../models/results.model';

interface TeamBreakdownCardsProps {
  t: Dictionary;
  teams: TeamBreakdownViewModel[];
  phraseGame?: boolean;
}

const Row = ({ label, value }: { label: string; value: number | string }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-ink-2">{label}</span>
    <span
      className={cn(
        'font-mono font-semibold tabular-nums',
        typeof value === 'number' && value > 0 && 'text-green-ink',
        typeof value === 'number' && value < 0 && 'text-red',
        typeof value === 'number' && value === 0 && 'text-ink-3',
      )}
    >
      {typeof value === 'number' && value > 0 ? `+${value}` : value}
    </span>
  </div>
);

/** One card per team with the team formula (docs/context/06-v1.1.md -> Team scoring). */
export const TeamBreakdownCards = ({ t, teams, phraseGame = false }: TeamBreakdownCardsProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {teams.map((team) => {
      const paint = paintFor(team.color);
      return (
        <Card
          key={team.team}
          className={cn(
            'flex flex-col gap-2.5 border-2 px-5 py-4',
            paint.border,
            team.isMine && paint.soft,
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className={cn('font-display text-xl font-bold tracking-[-0.02em]', paint.text)}>
              {teamLabel(t, { id: team.team, name: team.name })}
            </span>
            <span className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
              {team.roundPoints}
            </span>
          </div>
          <span
            className={cn(
              'text-[13px] font-semibold',
              team.solved ? 'text-green-ink' : 'text-ink-3',
            )}
          >
            {team.solved && team.solverName
              ? `${t.results.teamSolvedBy(team.solverName)} · ${t.common.ordinal(team.position ?? 0)}`
              : t.results.teamNotSolved}
          </span>
          <div className="h-px bg-line" />
          {phraseGame ? (
            <div className="flex flex-col gap-1.25">
              {team.solved ? (
                <>
                  <Row
                    label={`${t.results.rowTime} · ${team.timeLeftPercent ?? 0} %`}
                    value={team.timePoints}
                  />
                  <Row label={t.results.rowPhrase} value={team.solveBonus} />
                  <Row label={t.results.rowWords(team.wordsSent)} value={team.attemptPenalty} />
                  <Row label={t.results.rowSends(team.sendsFailed)} value={team.sendPenalty} />
                  <Row label={t.results.rowFirstTeam} value={team.positionBonus} />
                </>
              ) : (
                <>
                  <Row
                    label={t.results.rowUncovered(team.phrasePercent)}
                    value={team.uncoveredPoints}
                  />
                  <Row label={t.results.rowSends(team.sendsFailed)} value={team.sendPenalty} />
                </>
              )}
            </div>
          ) : team.solved ? (
            <div className="flex flex-col gap-1.25">
              <Row
                label={`${t.results.rowTime} · ${team.timeLeftPercent ?? 0} %`}
                value={team.timePoints}
              />
              <Row label={t.results.rowSolve} value={team.solveBonus} />
              <Row
                label={t.results.rowAttempts(team.attemptsAfterFirst)}
                value={team.attemptPenalty}
              />
              <Row label={t.results.rowFirstTeam} value={team.positionBonus} />
              <Row
                label={t.results.rowHint}
                value={team.hintBonus > 0 ? team.hintBonus : t.results.hintUsed}
              />
            </div>
          ) : (
            <p className="m-0 text-sm text-ink-3">{t.game.teamNotSolvedRow}</p>
          )}
        </Card>
      );
    })}
  </div>
);
