import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Card } from '@/shared/components/ui/Card';
import { ROOM_LIMITS, type ChatChannel } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { ChatMessageViewModel } from '../models/chat.model';

interface ChatPanelProps {
  t: Dictionary;
  messages: ChatMessageViewModel[];
  /** Team mode: the "(Equipo)" channel exists next to "(Todos)". */
  teamMode: boolean;
  channel: ChatChannel;
  onChannel: (channel: ChatChannel) => void;
  /** False while the round keeps me out of "(Todos)"; the composer says why. */
  canWrite: boolean;
  lockedReason: string | null;
  pending: boolean;
  onSend: (text: string) => void;
  /** Borderless, for the phone sheet. */
  bare?: boolean;
  className?: string;
}

/** Enter sends; the board's window listener must never see it. */
const keepKeys = (event: KeyboardEvent<HTMLElement>) => event.stopPropagation();

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
 * docs/context/06-v1.1.md -> Chat: one list, one composer, the channel
 * switch in team mode. The list is `aria-live` so a screen reader hears new
 * messages; it auto-scrolls to the newest one.
 */
export const ChatPanel = ({
  t,
  messages,
  teamMode,
  channel,
  onChannel,
  canWrite,
  lockedReason,
  pending,
  onSend,
  bare = false,
  className,
}: ChatPanelProps) => {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const toEnd = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);
  useEffect(toEnd, [messages.length, toEnd]);

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
        {teamMode ? (
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
      {messages.length === 0 ? (
        <p className="m-0 flex-1 px-4 pb-3 text-[13px] text-ink-3">{t.chat.empty}</p>
      ) : (
        <ul
          ref={listRef}
          aria-live="polite"
          aria-relevant="additions"
          className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto p-0 px-2 pb-2"
        >
          {messages.map((message) => (
            <Row key={message.id} t={t} message={message} />
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-1 border-t border-line px-3 py-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            value={draft}
            maxLength={ROOM_LIMITS.chatMaxLength}
            disabled={!canWrite}
            placeholder={
              canWrite
                ? channel === 'team'
                  ? t.chat.placeholderTeam
                  : t.chat.placeholderAll
                : (lockedReason ?? t.chat.locked)
            }
            aria-label={t.chat.composer}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={keepKeys}
            onKeyUp={keepKeys}
            className="h-10 min-w-0 flex-1 rounded-[10px] border-[1.5px] border-line bg-surface px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-ink disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || draft.trim().length === 0}
            className="h-10 shrink-0 rounded-[10px] bg-ink px-3.5 text-[13px] font-bold text-on-ink transition-opacity disabled:opacity-40"
          >
            {t.chat.send}
          </button>
        </div>
        <span className="text-right font-mono text-[10px] text-ink-3 tabular-nums">
          {draft.length}/{ROOM_LIMITS.chatMaxLength}
        </span>
      </form>
    </>
  );

  return bare ? (
    <div className={cn('flex min-h-0 flex-col', className)}>{body}</div>
  ) : (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden', className)}>{body}</Card>
  );
};
