import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Card } from '@/shared/components/ui/Card';
import { ROOM_LIMITS, type ChatChannel } from '@/shared/contract';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { ChatMessageViewModel } from '../models/chat.model';
import { toStream, type ChatStreamEvent } from '../models/stream.model';

interface ChatPanelProps {
  t: Dictionary;
  messages: ChatMessageViewModel[];
  /** The room's own events (solves, penalties, hints, arrivals, stickers). */
  events: ChatStreamEvent[];
  /** Team mode during the round: the "(Equipo)" channel exists next to "(Todos)". */
  channels: boolean;
  channel: ChatChannel;
  onChannel: (channel: ChatChannel) => void;
  /** False while the round keeps me out of "(Todos)": only the sticker is shown. */
  canWrite: boolean;
  /** Why text is locked; read by screen readers only, never drawn. */
  lockedReason: string | null;
  pending: boolean;
  onSend: (text: string) => void;
  /** The sticker picker's trigger, which sits next to the input. */
  sticker?: ReactNode;
  /** Borderless, for the phone sheet. */
  bare?: boolean;
  className?: string;
}

/** Enter sends; the board's window listener must never see it. */
const keepKeys = (event: KeyboardEvent<HTMLElement>) => event.stopPropagation();

/** How long the composer takes to open; the same number as `--animate-composer-in`. */
const OPEN_MS = 250;

const Row = ({ t, message }: { t: Dictionary; message: ChatMessageViewModel }) => (
  <li className="flex flex-col gap-1">
    {message.startsRound ? (
      <span className="my-1 flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-ink-3 uppercase">
        <span className="h-px flex-1 bg-line" />
        {t.chat.roundDivider(message.round)}
        <span className="h-px flex-1 bg-line" />
      </span>
    ) : null}
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-[10px] px-2.5 py-1.5 text-[13px] leading-[1.4]',
        message.channel === 'team' ? 'bg-accent-soft' : message.isMe ? 'bg-surface-2' : '',
      )}
    >
      <span className="flex items-baseline gap-1.5 text-xs">
        <strong className={cn('truncate', message.isMe ? 'text-accent' : 'text-ink')}>
          {message.name}
        </strong>
        {message.observer ? (
          <span className="rounded-full bg-surface-2 px-1.5 text-[10px] font-bold text-ink-3 uppercase">
            {t.chat.observerTag}
          </span>
        ) : null}
        <span className="text-[11px] text-ink-3">
          {message.channel === 'team' ? t.chat.teamTag : t.chat.allTag}
        </span>
        <span className="ml-auto font-mono text-[11px] text-ink-3 tabular-nums">
          {message.time}
        </span>
      </span>
      <span className="wrap-anywhere text-ink-2">{message.text}</span>
    </div>
  </li>
);

/**
 * One panel for the whole room (docs/context/06-v1.1.md -> Chat): the round's
 * events, the stickers and the text messages in a single stream in time order,
 * the composer at the bottom with the sticker trigger beside it, and the
 * channel switch only where text has channels. The list is `aria-live` so a
 * screen reader hears what arrives; it auto-scrolls to the newest item.
 *
 * While text is locked the composer is the sticker alone, centred; it opens
 * with a 250 ms move the moment the player may write (2026-09-18).
 */
export const ChatPanel = ({
  t,
  messages,
  events,
  channels,
  channel,
  onChannel,
  canWrite,
  lockedReason,
  pending,
  onSend,
  sticker,
  bare = false,
  className,
}: ChatPanelProps) => {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const toEnd = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);
  // One stream: the room's events, its stickers and the text messages.
  const items = toStream(messages, events);
  useEffect(toEnd, [items.length, toEnd]);

  // While text is locked the composer is the sticker alone, centred: a disabled
  // field with a cut placeholder read as a broken panel, and the field turning
  // up is itself the sign that talking is allowed
  // (docs/context/04-decisions-and-pending.md, 2026-09-18). The opening is
  // animated only on the lock -> unlock transition; a panel that mounts already
  // open (lobby, results) draws the full composer with no animation at all.
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [opening, setOpening] = useState(false);
  const stickerRef = useRef<HTMLSpanElement>(null);
  const stickerLeft = useRef<number | null>(null);
  const wasLocked = useRef(!canWrite);

  useLayoutEffect(() => {
    const node = stickerRef.current;
    const left = node?.getBoundingClientRect().left ?? null;
    const from = stickerLeft.current;
    stickerLeft.current = left;
    const opened = canWrite && wasLocked.current;
    wasLocked.current = !canWrite;
    if (!opened) return;
    setOpening(true);
    // The sticker travels from where it was (centred) to where it is now
    // (left), measured rather than guessed so the move is exact whatever the
    // panel's width. Reduced motion keeps the jump.
    if (reduceMotion || !node || from === null || left === null) return;
    const shift = from - left;
    if (Math.abs(shift) < 1) return;
    node.style.transition = 'none';
    node.style.transform = `translateX(${shift}px)`;
    requestAnimationFrame(() => {
      node.style.transition = `transform ${OPEN_MS}ms ease-out`;
      node.style.transform = 'translateX(0px)';
    });
    // The lock is the only thing that moves the sticker, so measuring on its
    // changes alone is enough — and it keeps the transform out of the reading.
  }, [canWrite, reduceMotion]);

  // One timer ends the opening: the classes come off and the sticker goes back
  // to having no inline style of its own.
  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => {
      setOpening(false);
      const node = stickerRef.current;
      if (node) node.removeAttribute('style');
    }, OPEN_MS + 60);
    return () => window.clearTimeout(timer);
  }, [opening]);

  const disabled = !canWrite || pending;
  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft('');
  };

  const body = (
    <>
      <div
        className={cn('flex items-center justify-between gap-2 px-4 pt-3.5 pb-2', bare && 'pr-14')}
      >
        <span className="label">{t.chat.title}</span>
        {channels ? (
          <div role="radiogroup" aria-label={t.chat.channel} className="flex gap-1">
            {(['team', 'all'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={channel === option}
                onClick={() => onChannel(option)}
                className={cn(
                  'h-7 rounded-full px-2.5 text-[11px] font-bold transition-colors',
                  channel === option ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink-2',
                )}
              >
                {option === 'team' ? t.chat.channelTeam : t.chat.channelAll}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="m-0 flex-1 px-4 pb-3 text-[13px] text-ink-3">{t.chat.empty}</p>
      ) : (
        <ul
          ref={listRef}
          aria-live="polite"
          aria-relevant="additions"
          className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto p-0 px-2 pb-2"
        >
          {items.map((item) =>
            item.kind === 'message' ? (
              <Row key={`m${item.message.id}`} t={t} message={item.message} />
            ) : (
              <Fragment key={`e${item.event.id}`}>{item.event.node}</Fragment>
            ),
          )}
        </ul>
      )}
      <form
        className={cn(
          'flex flex-col gap-1 border-t border-line px-3',
          // Nothing to show on a phone, where the sticker trigger lives under
          // the keyboard: the locked composer takes no height at all.
          canWrite || sticker ? 'py-2.5' : 'py-0',
        )}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className={cn('flex items-center gap-2', !canWrite && 'justify-center')}>
          <span ref={stickerRef} className="flex shrink-0 items-center">
            {sticker}
          </span>
          {canWrite ? (
            <>
              <input
                value={draft}
                maxLength={ROOM_LIMITS.chatMaxLength}
                placeholder={channel === 'team' ? t.chat.placeholderTeam : t.chat.placeholderAll}
                aria-label={t.chat.composer}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={keepKeys}
                onKeyUp={keepKeys}
                className={cn(
                  'h-10 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-surface px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-ink',
                  opening && 'animate-composer-in',
                )}
              />
              <button
                type="submit"
                disabled={disabled || draft.trim().length === 0}
                className={cn(
                  'h-10 shrink-0 rounded-[10px] bg-ink px-3.5 text-[13px] font-bold text-on-ink transition-opacity disabled:opacity-40',
                  opening && 'animate-composer-in',
                )}
              >
                {t.chat.send}
              </button>
            </>
          ) : (
            // Why the field is not there, for a screen reader only.
            <span className="sr-only">{lockedReason ?? t.chat.locked}</span>
          )}
        </div>
        {canWrite ? (
          <span
            className={cn(
              'text-right font-mono text-[10px] text-ink-3 tabular-nums',
              opening && 'animate-composer-in',
            )}
          >
            {draft.length}/{ROOM_LIMITS.chatMaxLength}
          </span>
        ) : null}
      </form>
    </>
  );

  return bare ? (
    <div className={cn('flex min-h-0 flex-col', className)}>{body}</div>
  ) : (
    // No `overflow-hidden`: the sticker picker in the composer opens above it
    // and must not be clipped by the card.
    <Card className={cn('flex min-h-0 flex-col', className)}>{body}</Card>
  );
};
