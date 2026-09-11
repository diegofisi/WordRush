import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import type { Emote } from '@/shared/contract';

interface ReactionBubbleProps {
  emote: Emote;
  label: string;
  size?: 'md' | 'sm';
}

/** Speech bubble above a rival avatar (Main.dc.html), fades out via `animate-bubble`. */
export const ReactionBubble = ({ emote, label, size = 'md' }: ReactionBubbleProps) => (
  <span
    role="img"
    aria-label={label}
    className={
      size === 'md'
        ? 'absolute -top-4.5 left-5.5 z-10 flex h-8 w-8 items-center justify-center rounded-[12px_12px_12px_2px] border border-line bg-surface text-ink shadow-card animate-bubble'
        : 'absolute -top-3.5 left-4.5 z-10 flex h-6 w-6 items-center justify-center rounded-[10px_10px_10px_2px] border border-line bg-surface text-ink shadow-card animate-bubble'
    }
  >
    <EmoteIcon emote={emote} size={size === 'md' ? 20 : 15} />
  </span>
);
