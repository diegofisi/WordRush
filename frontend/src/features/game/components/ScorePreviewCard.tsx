import { Card } from '@/shared/components/ui/Card';
import { SCORING } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { ScorePreview } from '../helpers/scorePreview';
import type { MyOutcome } from '../models/game-view.model';

interface ScorePreviewCardProps {
  t: Dictionary;
  preview: ScorePreview;
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

/** The "if you solve now" score preview (Main.dc.html), computed from SCORING. */
export const ScorePreviewCard = ({ t, preview, outcome }: ScorePreviewCardProps) => {
  const title = outcome === 'playing' ? t.game.ifYouSolveNow : t.game.yourRound;
  return (
    <Card className="flex flex-col gap-2 px-4 pt-3.5 pb-3">
      <div className="flex items-center justify-between">
        <span className="label">{title}</span>
        {preview.mode === 'solve' ? (
          <span className="text-xs text-ink-3">{t.game.arrivalPosition(preview.position)}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.25 text-[13px]">
        {preview.mode === 'solve' ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">{t.game.timeLeftRow(preview.timePercent)}</span>
              <span className="font-mono font-semibold tabular-nums">+{preview.timePoints}</span>
            </div>
            <Row
              label={
                preview.attemptsAfterFirst === 0
                  ? t.game.firstAttemptRow
                  : t.game.attemptsRow(preview.attemptsAfterFirst)
              }
              value={preview.attemptPenalty}
            />
            <Row
              label={
                preview.positionBonus > 0
                  ? t.game.positionRow(preview.position)
                  : t.game.noPositionBonus
              }
              value={preview.positionBonus}
            />
            <Row
              label={preview.hintKept ? t.game.hintKeptRow : t.game.hintUsedRow}
              value={preview.hintBonus}
            />
            {preview.floorApplied ? (
              <Row label={t.game.floorRow} value={SCORING.solveFloor - preview.subtotal} />
            ) : null}
          </>
        ) : (
          <Row label={t.game.greens(preview.greens)} value={preview.greenPoints} />
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
