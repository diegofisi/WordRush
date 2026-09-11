import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import type { Emote } from '@/shared/contract';

interface ReactionBubbleProps {
  emote: Emote;
  label: string;
  /** `md` is the desktop rivals panel (40 px art), `sm` the phone strip (32 px). */
  size?: 'md' | 'sm';
}

/**
 * Speech bubble above a rival avatar. The sticker is the star, so the bubble is
 * only a thin frame around it; it pops in and floats away with `animate-bubble`,
 * the same gesture as the sender's own burst in the top bar.
 */
export const ReactionBubble = ({ emote, label, size = 'md' }: ReactionBubbleProps) => (
  <span
    role="img"
    aria-label={label}
    className={
      size === 'md'
        ? 'animate-bubble absolute -top-7 left-4 z-10 flex h-12 w-12 items-center justify-center rounded-[16px_16px_16px_4px] border border-line bg-surface shadow-card'
        : 'animate-bubble absolute -top-6 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-[13px_13px_13px_3px] border border-line bg-surface shadow-card'
    }
  >
    <EmoteIcon emote={emote} size={size === 'md' ? 40 : 32} />
  </span>
);
