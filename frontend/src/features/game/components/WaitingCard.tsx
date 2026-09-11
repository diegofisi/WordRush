import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';

import type { MyOutcome } from '../models/game-view.model';

interface WaitingCardProps {
  t: Dictionary;
  outcome: Exclude<MyOutcome, 'playing'>;
  solvedPosition: number | null;
  timePercent: number;
}

/** Calm state shown instead of the keyboard once I am done with the round. */
export const WaitingCard = ({ t, outcome, solvedPosition, timePercent }: WaitingCardProps) => {
  const detail =
    outcome === 'solved'
      ? t.game.waitingSolved(solvedPosition ?? 0, timePercent)
      : outcome === 'out-of-attempts'
        ? t.game.waitingOutOfAttempts
        : t.game.waitingOutOfTime;
  return (
    <Card
      role="status"
      className={`flex w-full max-w-130 flex-col items-center gap-1.5 px-5 py-4 text-center animate-fade-in ${
        outcome === 'solved' ? 'border-green/40 bg-green-soft' : ''
      }`}
    >
      <span className="font-display text-xl font-bold tracking-[-0.02em]">
        {t.game.waitingTitle}
      </span>
      <span className="text-sm text-ink">{detail}</span>
      <span className="text-xs text-ink-3">{t.game.waitingBody}</span>
    </Card>
  );
};
