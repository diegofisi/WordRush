import { HintIcon } from '@/shared/components/icons/GameIcons';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { HintButtonState } from '../models/game.model';

interface HintButtonProps {
  t: Dictionary;
  state: HintButtonState;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
  compact?: boolean;
  /** Team mode: the one hint is the team's. */
  team?: boolean;
}

/**
 * The hint in the top bar (docs/context/06-v1.1.md): a yellow pill with the
 * bulb and one word. No glow, no ring and no pulse since 2026-09-17 — its
 * state is the whole message: live and yellow while there is a hint to spend,
 * muted and disabled once it is used or the room plays without it. The detail
 * ("1 disponible", "usada") stays in the tooltip and the accessible name.
 */
export const HintButton = ({
  t,
  state,
  pending,
  disabled,
  onClick,
  compact = false,
  team = false,
}: HintButtonProps) => {
  const inactive = state !== 'available' || disabled || pending;
  const caption =
    state === 'available'
      ? t.game.hintLeft(1)
      : state === 'used'
        ? t.game.hintUsed
        : t.game.hintOff;

  const label = team && !compact ? t.game.teamHint : t.common.hint;

  return (
    <button
      type="button"
      disabled={inactive}
      aria-busy={pending || undefined}
      onClick={onClick}
      title={`${label} · ${caption}`}
      aria-label={`${label} · ${caption}`}
      className={cn(
        'flex h-12 items-center gap-2.5 rounded-full border-2 px-4 text-[15px] font-bold transition-colors disabled:cursor-not-allowed sm:h-11 sm:px-5',
        inactive
          ? 'border-line bg-surface-2 text-ink-3'
          : 'border-yellow bg-yellow-soft text-yellow-deep',
      )}
    >
      <HintIcon size={20} />
      <span>{label}</span>
    </button>
  );
};
