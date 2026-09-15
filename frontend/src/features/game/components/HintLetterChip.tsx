import type { HintReveal } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

interface HintLetterChipProps {
  t: Dictionary;
  reveal: HintReveal;
  className?: string;
}

/**
 * The whole hint, next to the hint button: "Hay una L en la palabra" for a
 * letter (it also lights up on the keyboard, dashed yellow) or "La L va en la
 * posición 3" for a placement (a green dashed tile waits on the board).
 */
export const HintLetterChip = ({ t, reveal, className }: HintLetterChipProps) => {
  const letter = reveal.letter.toUpperCase();
  const placed = reveal.kind === 'position' && reveal.position !== null;
  return (
    <span
      role="status"
      className={cn(
        'inline-flex max-w-full items-center rounded-full border border-dashed px-3 py-1 text-xs font-semibold text-balance',
        placed
          ? 'border-green bg-green-soft text-green-ink'
          : 'border-yellow-line bg-yellow-soft text-yellow-deep',
        className,
      )}
    >
      {placed ? t.game.hintPosition(letter, (reveal.position ?? 0) + 1) : t.game.hintLetter(letter)}
    </span>
  );
};
