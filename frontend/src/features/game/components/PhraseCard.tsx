import { Card } from '@/shared/components/ui/Card';
import type { PhraseSelf } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { PhraseSlots } from './PhraseSlots';

interface PhraseCardProps {
  t: Dictionary;
  phrase: PhraseSelf;
  wordCount: number;
  /** Phone: the FRASE action is a pill in the header. */
  onOpen?: () => void;
  openDisabled?: boolean;
  /** Team mode: the phrase is shared. */
  shared?: boolean;
  className?: string;
}

/**
 * "La frase · 15 de 33 letras": the phrase as slots, found letters green,
 * nothing given away (docs/context/06-v1.1.md -> Guess the phrase).
 */
export const PhraseCard = ({
  t,
  phrase,
  wordCount,
  onOpen,
  openDisabled = false,
  shared = false,
  className,
}: PhraseCardProps) => (
  <Card className={cn('flex w-full flex-col gap-2.5 px-4 pt-3 pb-3.5', className)}>
    <div className="flex items-center justify-between gap-2">
      <span className="label">
        {t.game.phraseTitle} · {t.game.phraseLetters(phrase.found, phrase.total)}
        {shared ? ` · ${t.game.phraseShared}` : ''}
      </span>
      {onOpen ? (
        <button
          type="button"
          disabled={openDisabled}
          onClick={onOpen}
          className="h-8 shrink-0 rounded-full bg-accent px-3 text-xs font-bold text-white transition-opacity disabled:opacity-50"
        >
          {t.game.phraseKnow}
        </button>
      ) : null}
    </div>
    <PhraseSlots
      letters={phrase.letters}
      labels={{ found: t.game.tileCorrect, unknown: t.game.phraseUnknown }}
    />
    <span className="text-[12px] text-ink-3">{t.game.phraseCaption(wordCount)}</span>
  </Card>
);
