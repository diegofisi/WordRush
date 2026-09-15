import type { PhraseLetters, PhraseMask } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

interface PhraseSlotsProps {
  /** Somebody else's phrase: where they have a letter, never which. */
  mask?: PhraseMask;
  /** My own (or my team's) phrase: the letters found. */
  letters?: PhraseLetters;
  /** `md` in the phrase card, `xs` in the rivals list and the phone strip. */
  size?: 'md' | 'xs';
  /** Wording for the two slot states, for screen readers. */
  labels: { found: string; unknown: string };
}

/**
 * The phrase as slots per word (docs/context/06-v1.1.md -> Guess the phrase):
 * green where a letter is known. The rival variant carries no letters at all.
 */
export const PhraseSlots = ({ mask, letters, size = 'md', labels }: PhraseSlotsProps) => {
  const words: (string | null | boolean)[][] = letters ?? mask ?? [];
  const slot =
    size === 'md'
      ? 'h-8 w-7 rounded-[6px] text-[15px] sm:h-9 sm:w-8'
      : 'h-3 w-2.5 rounded-[3px] text-[7px]';
  const gap = size === 'md' ? 'gap-1' : 'gap-px';
  const wordGap = size === 'md' ? 'gap-x-3 gap-y-2' : 'gap-x-1.5 gap-y-1';
  return (
    <div className={cn('flex flex-wrap', wordGap)} role="group">
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className={cn('flex', gap)}>
          {word.map((cell, index) => {
            const found = typeof cell === 'boolean' ? cell : cell !== null;
            const letter = typeof cell === 'string' ? cell.toUpperCase() : '';
            return (
              <span
                key={index}
                aria-label={found ? `${letter || ''} ${labels.found}`.trim() : labels.unknown}
                className={cn(
                  'flex items-center justify-center border-b-2 font-display font-bold uppercase',
                  slot,
                  found
                    ? 'border-green bg-green text-white'
                    : 'border-dashed border-line-dashed bg-surface-2 text-transparent',
                )}
              >
                {letter}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
};
