import { Avatar } from '@/shared/components/ui/Avatar';
import type { TileColor } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';
import { paintFor, teamLabel } from '@/shared/lib/teamColor';

import type { TeamViewProps } from '../models/game-view.model';
import { MiniBoard } from './MiniBoard';
import { PhraseSlots } from './PhraseSlots';
import { TeammateBoard } from './TeammateBoard';

interface TeamStripProps {
  t: Dictionary;
  wordLength: number;
  team: TeamViewProps;
  lowTimeThreshold: number;
  colorLabels: Record<TileColor, string>;
  phraseGame?: boolean;
}

/**
 * Phone layout in team mode: my teammates (latest row with letters) on the
 * left, the rival team's clock and members (colours only) on the right.
 */
export const TeamStrip = ({
  t,
  wordLength,
  team,
  lowTimeThreshold,
  colorLabels,
  phraseGame = false,
}: TeamStripProps) => {
  const mine = paintFor(team.mine.color);
  const rival = team.rival;
  const rivalPaint = rival ? paintFor(rival.color) : null;
  const rivalLow = rival && !rival.finished && team.rivalClock < lowTimeThreshold;
  // Alone on the team: no own-team box at all, never a placeholder sentence.
  const showMine = team.teammates.length > 0;
  return (
    <div className="flex gap-2 overflow-x-auto">
      {showMine ? (
        <section
          aria-label={teamLabel(t, team.mine)}
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border-2 px-2 py-2',
            mine.border,
            mine.soft,
          )}
        >
          <span
            className={cn('truncate text-[10px] font-bold tracking-[0.08em] uppercase', mine.text)}
          >
            {teamLabel(t, team.mine)}
          </span>
          <ul className="m-0 flex list-none gap-2 p-0">
            {team.teammates.map((mate) => (
              <li
                key={mate.id}
                className="flex shrink-0 flex-col items-center gap-1"
                title={mate.name}
              >
                <Avatar name={mate.name} size={28} tone={mate.isSolver ? 'green' : mine.avatar} />
                <TeammateBoard
                  wordLength={wordLength}
                  rows={mate.rows}
                  size="xs"
                  lastRowOnly
                  colorLabels={colorLabels}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rival && rivalPaint ? (
        <section
          aria-label={teamLabel(t, rival)}
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border-2 px-2 py-2',
            rivalPaint.border,
            rivalPaint.soft,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'truncate text-[10px] font-bold tracking-[0.08em] uppercase',
                rivalPaint.text,
              )}
            >
              {teamLabel(t, rival)}
            </span>
            <span
              className={cn(
                'font-mono text-[11px] font-bold tabular-nums',
                rival.solved ? 'text-green-ink' : rivalLow ? 'text-red' : 'text-ink',
              )}
            >
              {rival.solved
                ? t.common.ordinal(rival.solvedPosition ?? 0)
                : rival.finished
                  ? '—'
                  : formatClock(team.rivalClock, false)}
            </span>
          </div>
          {phraseGame && rival.phrase ? (
            <PhraseSlots
              mask={rival.phrase.mask}
              size="xs"
              labels={{ found: t.game.tileCorrect, unknown: t.game.phraseUnknown }}
            />
          ) : null}
          <ul className="m-0 flex list-none gap-2 p-0">
            {rival.members.map((member) => (
              <li
                key={member.id}
                className="flex shrink-0 flex-col items-center gap-1"
                title={member.name}
              >
                <Avatar
                  name={member.name}
                  size={28}
                  tone={member.status === 'solved' ? 'green' : rivalPaint.avatar}
                />
                <MiniBoard wordLength={wordLength} rows={member.rows} size="xs" lastRowOnly />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
