import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import type { Emote } from '@/shared/contract';

interface ReactionBurstProps {
  emote: Emote;
  label: string;
  size?: number;
}

/**
 * The sender's own reaction, bursting out of their avatar in the top bar: the
 * sticker scales in oversized, floats up and fades. Rivals see the same gesture
 * in their bubble, so both read as one system. Absolutely positioned: the
 * caller supplies a `relative` box (the avatar).
 */
export const ReactionBurst = ({ emote, label, size = 40 }: ReactionBurstProps) => (
  <span
    role="img"
    aria-label={label}
    // The box is sized here on purpose: the avatar it hangs off is narrower than
    // the sticker, and without an explicit width the art would be squeezed to
    // fit the space left of the avatar's edge.
    style={{ width: size, height: size }}
    className="animate-reaction-burst pointer-events-none absolute -top-1 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center"
  >
    <EmoteIcon emote={emote} size={size} className="max-w-none" />
  </span>
);
