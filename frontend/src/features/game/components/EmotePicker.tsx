import { Smile } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import { EMOTES, type Emote } from '@/shared/contract';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { pushRecentEmote, readRecentEmotes } from '../helpers/recentEmotes';

interface EmotePickerProps {
  t: Dictionary;
  /** Seconds left of the burst pause; 0 while the player may react. */
  cooldownSeconds: number;
  onEmote: (emote: Emote) => void;
  /** `card` sits in the desktop right column, `row` under the phone keyboard. */
  variant?: 'card' | 'row';
}

/** Five stickers per row in the main grid; the arrow keys move by row/column. */
const COLUMNS = 5;

/** Roving focus with the arrow keys inside one row or grid of stickers. */
const moveFocus = (event: KeyboardEvent<HTMLDivElement>, columns: number) => {
  const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  const buttons = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-emote]'),
  ];
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) return;
  event.preventDefault();
  const step =
    event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowDown'
          ? columns
          : event.key === 'ArrowUp'
            ? -columns
            : 0;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : Math.min(buttons.length - 1, Math.max(0, current + step));
  buttons[next]?.focus();
};

/**
 * The board listens for physical keys on `window` (`usePhysicalKeyboard`) and
 * turns Enter into a guess. The trigger and every sticker are ordinary buttons
 * that activate on Enter and Space, so those two keys must stop here instead of
 * reaching the board.
 */
const keepActivationKeys = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
};

interface StickerProps {
  emote: Emote;
  label: string;
  size: number;
  onPick: (emote: Emote) => void;
}

/** One sticker: it grows on hover/focus and shows its label above, iMessage style. */
const Sticker = ({ emote, label, size, onPick }: StickerProps) => (
  <button
    type="button"
    data-emote={emote}
    aria-label={label}
    onClick={() => onPick(emote)}
    className="group relative flex items-center justify-center rounded-xl p-1 transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] outline-none hover:scale-125 focus-visible:scale-125 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100"
  >
    <EmoteIcon emote={emote} size={size} />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-6.5 left-1/2 z-20 -translate-x-1/2 scale-90 rounded-full bg-ink px-2 py-0.75 text-[11px] font-semibold whitespace-nowrap text-on-ink opacity-0 transition duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  </button>
);

/**
 * Facebook / iMessage style reaction picker: one round trigger that opens an
 * anchored popover (a full-width sheet on phones) with the twenty stickers and
 * the five most recently used ones. Click or tap only; Escape and a click
 * outside close it. While the burst pause runs the trigger shows the countdown
 * and is disabled (see `docs/context/02-game-rules.md` → Emotes).
 */
export const EmotePicker = ({
  t,
  cooldownSeconds,
  onEmote,
  variant = 'card',
}: EmotePickerProps) => {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<Emote[]>(readRecentEmotes);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isPhone = useMediaQuery('(max-width: 639px)');
  const disabled = cooldownSeconds > 0;

  const close = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  // The pause closes the picker: there is nothing to send while it runs.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  // Opening with the keyboard lands on the first sticker of the grid.
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>('button[data-emote]')?.focus();
  }, [open]);

  const pick = (emote: Emote) => {
    setRecent(pushRecentEmote(emote));
    close(false);
    onEmote(emote);
  };

  return (
    <div ref={rootRef} className={cn('relative flex', variant === 'card' && 'justify-center')}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={disabled ? t.game.reactionCooldown : t.game.reactionsOpen}
        title={disabled ? t.game.reactionCooldown : t.game.reactionsOpen}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={keepActivationKeys}
        className={cn(
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-[transform,color,background-color] hover:bg-surface-2 hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:active:scale-100',
          open && 'bg-surface-2 text-ink',
        )}
      >
        <Smile size={22} strokeWidth={2} aria-hidden="true" />
        {disabled ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1 font-mono text-[11px] font-bold text-white tabular-nums"
          >
            {cooldownSeconds}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onKeyDown={keepActivationKeys}
          className={cn(
            // Phones: a sheet pinned to the bottom edge, always inside the viewport.
            'animate-emote-pop fixed inset-x-0 bottom-0 z-50 flex flex-col gap-1.5 rounded-t-2xl border border-line bg-surface px-3 pt-8 pb-4 shadow-pop',
            // From 640 px up it is anchored above the trigger. Right-aligned in
            // both variants: at 64 px the grid is wider than the column it hangs
            // off, and centring it on the trigger pushed it off the screen edge.
            'sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-full sm:mb-2 sm:w-max sm:max-w-[min(92vw,26rem)] sm:rounded-2xl sm:pb-3',
          )}
        >
          <span id={titleId} className="sr-only">
            {t.game.reactions}
          </span>

          {recent.length > 0 ? (
            <>
              <span className="label px-1">{t.game.reactionsRecent}</span>
              <div
                role="group"
                aria-label={t.game.reactionsRecent}
                onKeyDown={(event) => moveFocus(event, recent.length)}
                className="flex items-center gap-1 px-1 pb-1"
              >
                {recent.map((emote) => (
                  <Sticker
                    key={emote}
                    emote={emote}
                    label={t.emotes[emote]}
                    size={isPhone ? 40 : 48}
                    onPick={pick}
                  />
                ))}
              </div>
              <span className="h-px bg-line" aria-hidden="true" />
              <span className="label px-1 pt-1.5">{t.game.reactionsAll}</span>
            </>
          ) : null}

          <div
            ref={gridRef}
            role="group"
            aria-label={t.game.reactions}
            onKeyDown={(event) => moveFocus(event, COLUMNS)}
            className="grid grid-cols-5 justify-items-center gap-x-1 gap-y-2.5 px-1 pt-1"
          >
            {EMOTES.map((emote) => (
              <Sticker
                key={emote}
                emote={emote}
                label={t.emotes[emote]}
                size={isPhone ? 52 : 64}
                onPick={pick}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
