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

/**
 * The hint, impossible to miss (docs/context/06-v1.1.md): a tall yellow pill
 * that pulses until it is spent, with the hints left on it.
 */
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
      ? t.game.hintLeft(1)
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
        'flex h-12 items-center gap-2.5 rounded-full border-2 border-yellow bg-yellow-soft px-4 text-[15px] font-bold text-yellow-deep transition-opacity disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:px-5',
        !inactive && 'hint-pulse',
      )}
    >
      <HintIcon size={20} />
      <span>{t.common.hint}</span>
      {!compact ? <span className="font-medium text-yellow-mid">{caption}</span> : null}
    </button>
  );
};
