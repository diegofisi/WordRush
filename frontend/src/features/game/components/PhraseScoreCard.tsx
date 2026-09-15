import { Card } from '@/shared/components/ui/Card';
import { PHRASE_RULES } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { PhraseScorePreview } from '../helpers/phraseScorePreview';

interface PhraseScoreCardProps {
  t: Dictionary;
  preview: PhraseScorePreview;
  /** The round is over for me (or my team). */
  finished: boolean;
  teamMode: boolean;
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

/** "Si completas ahora" / "Tu ronda" for the phrase game (the mockup's card). */
export const PhraseScoreCard = ({ t, preview, finished, teamMode }: PhraseScoreCardProps) => {
  const title = finished
    ? teamMode
      ? t.game.teamRound
      : t.game.yourRound
    : teamMode
      ? t.game.ifTeamCompletesNow
      : t.game.ifYouCompleteNow;
  return (
    <Card className="flex flex-col gap-2 px-4 pt-3.5 pb-3">
      <div className="flex items-center justify-between">
        <span className="label">{title}</span>
        {preview.mode === 'complete' ? (
          <span className="text-xs text-ink-3">{t.game.arrivalPosition(preview.position)}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.25 text-[13px]">
        {preview.mode === 'complete' ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">{t.game.timeLeftRow(preview.timePercent)}</span>
              <span className="font-mono font-semibold tabular-nums">+{preview.timePoints}</span>
            </div>
            <Row label={t.game.phraseCompleteRow} value={preview.completeBonus} />
            <Row
              label={
                teamMode
                  ? t.game.teamWordsRow(preview.wordsSent)
                  : t.game.wordsRow(preview.wordsSent)
              }
              value={preview.wordPenalty}
            />
            <Row
              label={t.game.missesRow(preview.sendsFailed, PHRASE_RULES.sends)}
              value={preview.sendPenalty}
            />
            <Row
              label={
                preview.positionBonus > 0
                  ? t.game.completeOrderRow(preview.position)
                  : t.game.noPositionBonus
              }
              value={preview.positionBonus}
            />
          </>
        ) : (
          <>
            <Row label={t.game.uncoveredRow(preview.percent)} value={preview.uncoveredPoints} />
            <Row
              label={t.game.missesRow(preview.sendsFailed, PHRASE_RULES.sends)}
              value={preview.sendPenalty}
            />
          </>
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
