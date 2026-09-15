import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/shared/components/ui/Button';
import { PHRASE_RULES, type PhraseSelf } from '@/shared/contract';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock } from '@/shared/lib/format';

interface PhraseModalProps {
  t: Dictionary;
  open: boolean;
  phrase: PhraseSelf;
  /** Seconds left on my (or my team's) clock, ticking. */
  secondsLeft: number;
  pending: boolean;
  /** Per word, per letter: true where the last send was wrong; null before any miss. */
  wrong: boolean[][] | null;
  onClose: () => void;
  onSend: (text: string) => void;
}

/** Cursor over the unknown slots: [word, letter]. */
type Slot = [number, number];

/** Enter sends, Escape closes; nothing here reaches the board's window listener. */
const keep = (event: KeyboardEvent<HTMLElement>) => event.stopPropagation();

/**
 * "Completa la frase" (docs/context/06-v1.1.md -> Guess the phrase): the known
 * letters fixed, the rest typed slot by slot; a miss leaves the modal open with
 * the wrong letters in red so the player can try again or close.
 */
export const PhraseModal = ({
  t,
  open,
  phrase,
  secondsLeft,
  pending,
  wrong,
  onClose,
  onSend,
}: PhraseModalProps) => {
  const card = useRef<HTMLDivElement>(null);
  useFocusTrap(card, open);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState(0);

  const slots = useMemo<Slot[]>(() => {
    const list: Slot[] = [];
    phrase.letters.forEach((word, wi) =>
      word.forEach((letter, li) => {
        if (letter === null) list.push([wi, li]);
      }),
    );
    return list;
  }, [phrase.letters]);

  // Every opening starts clean at the first empty slot.
  useEffect(() => {
    if (open) {
      setTyped({});
      setCursor(0);
    }
  }, [open]);

  const key = (slot: Slot) => `${slot[0]}-${slot[1]}`;
  const text = () =>
    phrase.letters
      .map((word, wi) => word.map((letter, li) => letter ?? typed[`${wi}-${li}`] ?? '').join(''))
      .join(' ');
  const complete = slots.every((slot) => (typed[key(slot)] ?? '').length === 1);
  const sendsLeft = PHRASE_RULES.sends - phrase.sendsUsed;

  const submit = () => {
    if (!complete || pending) return;
    onSend(text());
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      const slot = slots[index];
      if (slot && typed[key(slot)]) {
        setTyped((state) => ({ ...state, [key(slot)]: '' }));
      } else if (index > 0) {
        const previous = slots[index - 1];
        if (previous) setTyped((state) => ({ ...state, [key(previous)]: '' }));
        setCursor(index - 1);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      setCursor(index - 1);
    } else if (event.key === 'ArrowRight' && index < slots.length - 1) {
      setCursor(index + 1);
    }
  };

  const onChange = (index: number) => (value: string) => {
    const letter = value
      .replace(/[^a-zñA-ZÑ]/g, '')
      .slice(-1)
      .toLowerCase();
    const slot = slots[index];
    if (!slot) return;
    setTyped((state) => ({ ...state, [key(slot)]: letter }));
    if (letter && index < slots.length - 1) setCursor(index + 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8"
      onClick={onClose}
    >
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={t.game.phraseModalTitle}
        onKeyDown={keep}
        onKeyUp={keep}
        className="flex w-full max-w-160 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xl animate-fade-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-xl font-extrabold tracking-[-0.02em]">
            {t.game.phraseModalTitle}
          </h2>
          <p className="m-0 text-sm text-ink-2">
            {t.game.phraseModalBody(PHRASE_RULES.sendPenalty, sendsLeft)}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-3" aria-label={t.game.phraseTitle}>
          {phrase.letters.map((word, wi) => (
            <span key={wi} className="flex gap-1">
              {word.map((letter, li) => {
                if (letter !== null) {
                  return (
                    <span
                      key={li}
                      className="flex h-10 w-8 items-center justify-center rounded-[6px] border-b-2 border-green bg-green font-display text-base font-bold text-white uppercase sm:h-11 sm:w-9"
                    >
                      {letter}
                    </span>
                  );
                }
                const index = slots.findIndex((slot) => slot[0] === wi && slot[1] === li);
                const value = typed[`${wi}-${li}`] ?? '';
                const missed = Boolean(wrong?.[wi]?.[li]) && value.length === 1;
                return (
                  <input
                    key={li}
                    value={value.toUpperCase()}
                    ref={(node) => {
                      if (node && index === cursor) node.focus();
                    }}
                    maxLength={1}
                    inputMode="text"
                    autoCapitalize="characters"
                    aria-label={t.game.phraseSlot(wi + 1, li + 1)}
                    onFocus={() => setCursor(index)}
                    onChange={(event) => onChange(index)(event.target.value)}
                    onKeyDown={onKeyDown(index)}
                    className={cn(
                      'h-10 w-8 rounded-[6px] border-2 bg-surface text-center font-display text-base font-bold uppercase outline-none sm:h-11 sm:w-9',
                      missed
                        ? 'border-red text-red'
                        : value
                          ? 'border-ink text-ink'
                          : 'border-dashed border-line-dashed text-ink',
                      index === cursor && 'ring-2 ring-accent/40',
                    )}
                  />
                );
              })}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-[13px] text-ink-2">
            {t.game.phraseModalFooter(
              Math.round((phrase.found / Math.max(1, phrase.total)) * 100),
              formatClock(secondsLeft),
            )}
          </span>
          <div className="flex gap-2.5">
            <Button variant="ghost" onClick={onClose}>
              {t.game.phraseClose}
            </Button>
            <Button
              variant="primary"
              loading={pending}
              disabled={!complete || sendsLeft <= 0}
              onClick={submit}
            >
              {t.game.phraseSend}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
