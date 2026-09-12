import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

interface HintLetterChipProps {
  t: Dictionary;
  letter: string;
  /** Occurrences of the letter in the answer; the copy says "dos" / "two". */
  count: number;
  className?: string;
}

/**
 * "Hay dos L en la palabra": the whole hint, next to the hint button. The
 * position is never revealed, so nothing is marked on the board; the letter
 * also lights up on the keyboard with the dashed yellow hint style.
 */
export const HintLetterChip = ({ t, letter, count, className }: HintLetterChipProps) => (
  <span
    role="status"
    className={cn(
      'inline-flex max-w-full items-center rounded-full border border-dashed border-yellow-line bg-yellow-soft px-3 py-1 text-xs font-semibold text-balance text-yellow-deep',
      className,
    )}
  >
    {t.game.hintInWord(letter.toUpperCase(), count)}
  </span>
);
