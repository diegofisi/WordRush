import { Avatar } from '@/shared/components/ui/Avatar';
import { Card } from '@/shared/components/ui/Card';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

import type { RivalViewModel } from '../models/game.model';
import { MiniBoard } from './MiniBoard';
import { PhraseSlots } from './PhraseSlots';

interface RivalsPanelProps {
  t: Dictionary;
  wordLength: number;
  rivals: RivalViewModel[];
  rivalClocks: Record<string, number>;
  solvedCount: number;
  lowTimeThreshold: number;
  /** Phrase game: slots instead of boards, letters counted instead of attempts. */
  phraseGame?: boolean;
}

const statusLine = (t: Dictionary, rival: RivalViewModel, phraseGame: boolean) => {
  switch (rival.status) {
    case 'solved':
      return phraseGame ? t.game.rivalPhraseComplete(rival.rows.length) : t.game.solved;
    case 'out-of-attempts':
      return phraseGame ? t.game.outOfSends : t.game.outOfAttempts;
    case 'out-of-time':
      return t.game.outOfTime;
    case 'left':
      return t.game.left;
    default: {
      const parts = phraseGame
        ? [
            rival.phrase
              ? t.game.rivalPhraseProgress(
                  rival.phrase.found,
                  rival.phrase.total,
                  rival.currentAttempt,
                )
              : t.game.attempt(rival.currentAttempt),
          ]
        : [t.game.attempt(rival.currentAttempt)];
      if (!phraseGame && rival.greens >= 4) parts.push(t.game.greens(rival.greens));
      if (!rival.connected) parts.push(t.game.disconnected);
      return parts.join(' · ');
    }
  }
};

export const RivalsPanel = ({
  t,
  wordLength,
  rivals,
  rivalClocks,
  solvedCount,
  lowTimeThreshold,
  phraseGame = false,
}: RivalsPanelProps) => (
  <Card className="flex min-h-0 flex-col overflow-hidden">
    <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
      <span className="label">
        {t.game.rivals} · {rivals.length}
      </span>
      {phraseGame ? (
        <span className="text-xs text-ink-3">{t.game.rivalsPhraseHint}</span>
      ) : solvedCount > 0 ? (
        <span className="text-xs text-ink-3">{t.game.alreadySolved(solvedCount)}</span>
      ) : null}
    </div>
    <ul className="m-0 flex min-h-0 list-none flex-col gap-1 overflow-y-auto p-0 px-2 pb-2">
      {rivals.map((rival) => {
        const seconds = rivalClocks[rival.id] ?? rival.secondsLeft;
        const low = rival.status === 'playing' && seconds < lowTimeThreshold;
        return (
          <li
            key={rival.id}
            className={cn(
              'flex items-center gap-3 rounded-[10px] p-2',
              rival.status === 'solved' && 'bg-green-soft',
              !rival.connected && 'opacity-60',
            )}
          >
            <Avatar name={rival.name} tone={rival.status === 'solved' ? 'green' : 'neutral'} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.75">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{rival.name}</span>
                {rival.status === 'solved' ? (
                  <span className="font-mono text-xs font-semibold text-green-ink">
                    {t.common.ordinal(rival.solvedPosition ?? 0)} · {rival.timePercent ?? 0}%
                  </span>
                ) : (
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums',
                      low ? 'font-semibold text-red' : 'text-ink-2',
                    )}
                  >
                    {formatClock(seconds)}
                  </span>
                )}
              </div>
              {phraseGame && rival.phrase ? (
                <div className="flex flex-col gap-1">
                  <PhraseSlots
                    mask={rival.phrase.mask}
                    size="xs"
                    labels={{ found: t.game.tileCorrect, unknown: t.game.phraseUnknown }}
                  />
                  <span
                    className={cn(
                      'truncate text-xs',
                      rival.status === 'solved' ? 'font-semibold text-green-ink' : 'text-ink-3',
                    )}
                  >
                    {statusLine(t, rival, true)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-17 shrink-0">
                    <MiniBoard wordLength={wordLength} rows={rival.rows} />
                  </div>
                  <span
                    className={cn(
                      'truncate text-xs',
                      rival.status === 'solved' ? 'font-semibold text-green-ink' : 'text-ink-3',
                    )}
                  >
                    {statusLine(t, rival, false)}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  </Card>
);
