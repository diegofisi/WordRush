import { Avatar } from '@/shared/components/ui/Avatar';
import { Card } from '@/shared/components/ui/Card';
import type { TileColor } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';
import { paintFor, teamLabel } from '@/shared/lib/teamColor';

import type { RivalViewModel } from '../models/game.model';
import type { TeamViewProps } from '../models/game-view.model';
import { MiniBoard } from './MiniBoard';
import { PhraseSlots } from './PhraseSlots';
import { TeammateBoard } from './TeammateBoard';

interface TeamPanelProps {
  t: Dictionary;
  wordLength: number;
  team: TeamViewProps;
  lowTimeThreshold: number;
  colorLabels: Record<TileColor, string>;
  /** Phrase game: the rival team's phrase as slots; members show letters tried. */
  phraseGame?: boolean;
}

const rivalStatus = (t: Dictionary, rival: RivalViewModel) => {
  if (rival.status === 'left') return t.game.left;
  const parts = [t.game.attempt(rival.currentAttempt)];
  if (rival.greens >= 4) parts.push(t.game.greens(rival.greens));
  if (!rival.connected) parts.push(t.game.disconnected);
  return parts.join(' · ');
};

/**
 * Desktop left column in team mode: my teammates' boards with letters on top
 * (we play the same word), the rival team below with its one clock and
 * colours-only boards (docs/context/06-v1.1.md -> Teams).
 */
export const TeamPanel = ({
  t,
  wordLength,
  team,
  lowTimeThreshold,
  colorLabels,
  phraseGame = false,
}: TeamPanelProps) => {
  const mine = paintFor(team.mine.color);
  const rival = team.rival;
  const rivalPaint = rival ? paintFor(rival.color) : null;
  const rivalLow = rival && !rival.finished && team.rivalClock < lowTimeThreshold;
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card className={cn('flex min-h-0 flex-col overflow-hidden border-2', mine.border)}>
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
          <span className={cn('label', mine.text)}>{teamLabel(t, team.mine)}</span>
          <span className="text-xs text-ink-3">
            {team.solverName
              ? t.game.teamSolvedBy(team.solverName)
              : t.game.teammatesCount(team.teammates.length)}
          </span>
        </div>
        {team.teammates.length === 0 ? (
          <p className="m-0 px-4 pb-4 text-[13px] text-ink-3">{t.game.noTeammates}</p>
        ) : (
          <ul className="m-0 flex min-h-0 list-none flex-col gap-1 overflow-y-auto p-0 px-2 pb-2">
            {team.teammates.map((mate) => (
              <li
                key={mate.id}
                className={cn(
                  'flex items-start gap-3 rounded-[10px] p-2',
                  mate.isSolver && 'bg-green-soft',
                  !mate.connected && 'opacity-60',
                )}
              >
                <Avatar name={mate.name} tone={mate.isSolver ? 'green' : mine.avatar} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{mate.name}</span>
                    <span className="text-xs text-ink-3">
                      {mate.hasLeft
                        ? t.game.left
                        : mate.isSolver
                          ? t.game.solved
                          : !mate.connected
                            ? t.game.disconnected
                            : t.game.attempt(mate.rows.length + 1)}
                    </span>
                  </div>
                  <TeammateBoard
                    wordLength={wordLength}
                    rows={mate.rows}
                    colorLabels={colorLabels}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {rival && rivalPaint ? (
        <Card className={cn('flex min-h-0 flex-col overflow-hidden border-2', rivalPaint.border)}>
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <span className={cn('label', rivalPaint.text)}>{teamLabel(t, rival)}</span>
            {rival.solved ? (
              <span className="font-mono text-xs font-semibold text-green-ink">
                {t.common.ordinal(rival.solvedPosition ?? 0)} · {rival.timePercent ?? 0}%
              </span>
            ) : rival.finished ? (
              <span className="text-xs text-ink-3">{t.game.outOfTime}</span>
            ) : (
              <span
                className={cn(
                  'font-mono text-sm font-bold tabular-nums',
                  rivalLow ? 'text-red' : 'text-ink',
                )}
              >
                {formatClock(team.rivalClock)}
              </span>
            )}
          </div>
          {rival.solverName ? (
            <p className="m-0 px-4 pb-2 text-xs font-semibold text-green-ink">
              {t.game.teamSolvedBy(rival.solverName)}
            </p>
          ) : null}
          {phraseGame && rival.phrase ? (
            <div className="flex flex-col gap-1 px-4 pb-2">
              <PhraseSlots
                mask={rival.phrase.mask}
                size="xs"
                labels={{ found: t.game.tileCorrect, unknown: t.game.phraseUnknown }}
              />
              <span className="text-xs text-ink-3">
                {t.game
                  .rivalPhraseProgress(rival.phrase.found, rival.phrase.total, 0)
                  .replace(/ · .*$/, '')}{' '}
                · {t.game.rivalsPhraseHint}
              </span>
            </div>
          ) : null}
          <ul className="m-0 flex min-h-0 list-none flex-col gap-1 overflow-y-auto p-0 px-2 pb-2">
            {rival.members.map((member) => (
              <li
                key={member.id}
                className={cn(
                  'flex items-center gap-3 rounded-[10px] p-2',
                  member.status === 'solved' && 'bg-green-soft',
                  !member.connected && 'opacity-60',
                )}
              >
                <Avatar
                  name={member.name}
                  size={32}
                  tone={member.status === 'solved' ? 'green' : rivalPaint.avatar}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.75">
                  <span className="truncate text-sm font-semibold">{member.name}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-17 shrink-0">
                      <MiniBoard wordLength={wordLength} rows={member.rows} />
                    </div>
                    <span className="truncate text-xs text-ink-3">
                      {member.status === 'solved' ? t.game.solved : rivalStatus(t, member)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
};
