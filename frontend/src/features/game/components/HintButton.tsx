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
}

/** Yellow "hint available" pill from the top bar of Main.dc.html. */
export const HintButton = ({
  t,
  state,
  pending,
  disabled,
  onClick,
  compact = false,
}: HintButtonProps) => {
  const inactive = state !== 'available' || disabled || pending;
  const caption =
    state === 'available'
      ? t.game.hintAvailable
      : state === 'used'
        ? t.game.hintUsed
        : t.game.hintOff;
  return (
    <button
      type="button"
      disabled={inactive}
      aria-busy={pending || undefined}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center gap-2 rounded-full border border-yellow-line bg-yellow-soft px-3.5 text-sm font-semibold text-yellow-deep transition-opacity disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:px-4',
      )}
    >
      <HintIcon size={18} />
      <span>{t.common.hint}</span>
      {!compact ? <span className="font-medium text-yellow-mid">{caption}</span> : null}
    </button>
  );
};
