import { BOSS } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';
import { brainPath } from '@/shared/routes/paths';

import type { BossViewModel } from '../models/game-view.model';
import { MiniBoard } from './MiniBoard';

interface BossPanelProps {
  t: Dictionary;
  boss: BossViewModel;
  /** The room, so the brain tab opens on its own route. */
  roomCode: string;
  /** The phone gets a single row instead of the full block. */
  compact?: boolean;
}

/** Same reading as the player's own clock: green, then amber, then red. */
const barTone = (percent: number, down: boolean) => {
  if (down) return 'bg-tile-gray';
  if (percent < 18) return 'bg-red';
  if (percent < 35) return 'bg-yellow';
  return 'bg-green';
};

const statusOf = (t: Dictionary, boss: BossViewModel) => {
  if (boss.solved) return t.game.bossSolvedIt;
  if (boss.defeated) return t.game.bossDown;
  if (boss.decision) return t.game.bossAction[boss.decision.action];
  return t.game.bossAttempt(boss.attempt + 1, BOSS.maxAttempts);
};

/**
 * The fly's clock as a health bar (docs/context/06-boss-mode.md). Her board is
 * colours only, exactly like a rival's: the panel gives tension, not letters.
 */
export const BossPanel = ({ t, boss, roomCode, compact = false }: BossPanelProps) => {
  const tone = barTone(boss.percent, boss.defeated);
  const clock = formatClock(boss.secondsLeft);

  if (compact) {
    return (
      <section
        className={cn(
          'flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2',
          boss.defeated && 'opacity-70',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-display text-sm font-bold text-ink">{t.game.boss}</span>
            <span className="truncate font-mono text-[10px] text-ink-3">{statusOf(t, boss)}</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-track"
            role="progressbar"
            aria-label={t.game.bossHealth}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={boss.percent}
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-200', tone)}
              style={{ width: `${boss.percent}%` }}
            />
          </div>
        </div>
        <span className="font-mono text-base font-bold tabular-nums text-ink">{clock}</span>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border border-accent/40 bg-accent-soft p-3',
        boss.defeated && 'opacity-70',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-accent">{t.game.bossHealth}</span>
        <span className="font-mono text-[10px] text-ink-3">{statusOf(t, boss)}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-display text-lg font-extrabold leading-none text-ink">
          {t.game.boss}
        </span>
        <span className="ml-auto font-mono text-2xl font-bold tabular-nums leading-none text-ink">
          {clock}
        </span>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label={t.game.bossHealth}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={boss.percent}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-200', tone)}
          style={{ width: `${boss.percent}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-ink-3">
        <span>{t.game.bossStart(boss.startSeconds)}</span>
        {boss.damageSeconds > 0 ? (
          <span className="text-green-ink">{t.game.bossDamage(boss.damageSeconds)}</span>
        ) : null}
        {boss.forfeitedSeconds > 0 ? (
          <span className="text-faint">{t.game.bossForfeited(boss.forfeitedSeconds)}</span>
        ) : null}
      </div>

      {boss.rows.length > 0 ? <MiniBoard rows={boss.rows} /> : null}

      {/* Its own tab: the instrument is a second screen, not a lid over the
          board. The game tab keeps feeding it while it is open. */}
      <a
        href={brainPath(roomCode)}
        target="_blank"
        rel="noreferrer"
        title={t.game.bossOpenHint}
        className="rounded-lg border border-accent/40 px-2 py-1.5 text-center font-mono text-[10px] tracking-wider text-accent uppercase transition-colors hover:bg-accent/10"
      >
        {t.game.bossOpen} ↗
      </a>

      {boss.decision && !boss.solved && !boss.defeated ? (
        <div className="flex flex-col gap-1 border-t border-line pt-2">
          <span className="label text-ink-3">{t.game.bossThinking}</span>
          <span className="text-[13px] font-semibold text-ink">
            {t.game.bossAttempt(boss.attempt + 1, BOSS.maxAttempts)} ·{' '}
            {t.game.bossAction[boss.decision.action]}
          </span>
          <div className="flex flex-wrap gap-x-3 font-mono text-[10px] text-ink-3">
            <span>{t.game.bossConfidence(boss.decision.confidence)}</span>
          </div>

          {boss.decision.brain && boss.decision.letters.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1">
              <span className="label text-ink-3">{t.game.bossWants}</span>
              <div className="flex gap-1">
                {boss.decision.letters.map((letter, index) => (
                  <span
                    key={letter}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded font-display text-xs font-bold',
                      index === 0 ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2',
                    )}
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <span className="font-mono text-[10px] text-ink-3">
                {t.game.bossSimulated(boss.decision.biologicalMs, boss.decision.wallMs)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
