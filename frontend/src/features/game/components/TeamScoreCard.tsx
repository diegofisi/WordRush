import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { TeamScorePreview } from '../helpers/teamScorePreview';
import type { MyOutcome } from '../models/game-view.model';

interface TeamScoreCardProps {
  t: Dictionary;
  preview: TeamScorePreview;
  outcome: MyOutcome;
}

const Row = ({ label, value }: { label: string; value: number }) => (
  <div className="flex justify-between gap-3">
    <span className="text-ink-2">{label}</span>
    <span
      className={cn(
        'font-mono font-semibold tabular-nums',
        value > 0 ? 'text-green-ink' : value < 0 ? 'text-red' : 'text-ink-3',
      )}
    >
      {value > 0 ? `+${value}` : value}
    </span>
  </div>
);

/** The team's "if we solve now" preview (docs/context/06-v1.1.md -> Team scoring). */
export const TeamScoreCard = ({ t, preview, outcome }: TeamScoreCardProps) => {
  const title = outcome === 'playing' ? t.game.ifTeamSolvesNow : t.game.teamRound;
  return (
    <Card className="flex flex-col gap-2 px-4 pt-3.5 pb-3">
      <span className="label">{title}</span>
      <div className="flex flex-col gap-1.25 text-[13px]">
        {preview.mode === 'solve' ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">{t.game.timeLeftRow(preview.timePercent)}</span>
              <span className="font-mono font-semibold tabular-nums">+{preview.timePoints}</span>
            </div>
            <Row label={t.game.solveRow} value={preview.solveBonus} />
            <Row
              label={
                preview.attemptsAfterFirst === 0
                  ? t.game.teamFirstWordsRow
                  : t.game.teamAttemptsRow(preview.attemptsAfterFirst)
              }
              value={preview.attemptPenalty}
            />
            <Row
              label={preview.first ? t.game.firstTeamRow : t.game.notFirstTeamRow}
              value={preview.positionBonus}
            />
            <Row
              label={preview.hintKept ? t.game.hintKeptRow : t.game.hintUsedRow}
              value={preview.hintBonus}
            />
          </>
        ) : (
          <span className="text-ink-2">{t.game.teamNotSolvedRow}</span>
        )}
      </div>
      <div className="h-px bg-line" />
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">{t.game.roundTotal}</span>
        <span className="font-display text-[28px] font-extrabold tracking-[-0.02em] tabular-nums">
          {preview.total}
        </span>
      </div>
    </Card>
  );
};
