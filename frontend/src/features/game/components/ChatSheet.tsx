import { MessageCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

interface ChatSheetProps {
  t: Dictionary;
  open: boolean;
  unread: number;
  onToggle: () => void;
  /** The chat container, rendered inside the sheet. */
  children: ReactNode;
}

/**
 * Phone chat: a round trigger next to the stickers with the unread count, and a
 * sheet pinned to the bottom edge that holds the chat. Like the emote sheet it
 * is `fixed`, so it clears the home indicator itself.
 */
export const ChatSheet = ({ t, open, unread, onToggle, children }: ChatSheetProps) => (
  <>
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={open ? t.chat.close : t.chat.open}
      onClick={onToggle}
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink',
        open && 'bg-surface-2 text-ink',
      )}
    >
      <MessageCircle size={22} strokeWidth={2} aria-hidden="true" />
      {unread > 0 && !open ? (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[11px] font-bold text-white tabular-nums">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </button>
    {open ? (
      <div
        role="dialog"
        aria-label={t.chat.title}
        className="animate-emote-pop fixed inset-x-0 bottom-0 z-50 flex h-[70dvh] flex-col rounded-t-2xl border border-line bg-surface pb-[calc(var(--spacing)*2+var(--safe-bottom))] shadow-pop"
      >
        <button
          type="button"
          aria-label={t.chat.close}
          onClick={onToggle}
          className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
        >
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </div>
    ) : null}
  </>
);
