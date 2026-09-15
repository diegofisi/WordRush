import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';

import type { MyOutcome } from '../models/game-view.model';

interface WaitingCardProps {
  t: Dictionary;
  outcome: Exclude<MyOutcome, 'playing'>;
  solvedPosition: number | null;
  timePercent: number;
  /** Team mode: who solved it for us (`team-solved`). */
  solverName?: string | null;
  /** Phrase game: the wording changes (phrase, sends). */
  phraseGame?: boolean;
}

/** Calm state shown instead of the keyboard once I am done with the round. */
export const WaitingCard = ({
  t,
  outcome,
  solvedPosition,
  timePercent,
  solverName = null,
  phraseGame = false,
}: WaitingCardProps) => {
  const detail =
    outcome === 'solved'
      ? phraseGame
        ? t.game.waitingPhraseSolved(solvedPosition ?? 0, timePercent)
        : t.game.waitingSolved(solvedPosition ?? 0, timePercent)
      : outcome === 'team-solved'
        ? t.game.waitingTeamSolved(solverName ?? '?', timePercent)
        : outcome === 'out-of-sends'
          ? t.game.waitingOutOfSends
          : outcome === 'out-of-attempts'
            ? t.game.waitingOutOfAttempts
            : t.game.waitingOutOfTime;
  return (
    <Card
      role="status"
      className={`flex w-full max-w-130 flex-col items-center gap-1.5 px-5 py-4 text-center animate-fade-in ${
        outcome === 'solved' || outcome === 'team-solved' ? 'border-green/40 bg-green-soft' : ''
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
