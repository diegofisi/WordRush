import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

interface BossHomeOptionProps {
  t: Dictionary;
  active: boolean;
  onChange: (active: boolean) => void;
}

/**
 * The third, deliberately secondary choice next to the word/phrase switch:
 * "Retar a la mosca (modo antiguo)". It is a plain toggle rather than a third
 * segment of the pill because the fly is a legacy experiment, not one of the
 * two games the room is really for (docs/context/07-boss-removal.md).
 */
export const BossHomeOption = ({ t, active, onChange }: BossHomeOptionProps) => (
  <button
    type="button"
    aria-pressed={active}
    title={t.boss.homeOptionHint}
    onClick={() => onChange(!active)}
    className={cn(
      'h-10 rounded-full border px-3 text-[13px] font-bold whitespace-nowrap transition-colors',
      active
        ? 'border-accent bg-accent text-white'
        : 'border-line bg-surface text-ink-2 hover:text-ink',
    )}
  >
    {t.boss.homeOption}
  </button>
);
