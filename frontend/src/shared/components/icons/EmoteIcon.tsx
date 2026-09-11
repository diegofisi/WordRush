import type { Emote } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

import { customEmoteUrl } from './customEmotes';

interface EmoteIconProps {
  emote: Emote;
  size?: number;
  className?: string;
}

/**
 * One of the twenty emote stickers. The artwork is raster (see the README in
 * `src/assets/emotes/`), so it is never recoloured with `currentColor`; an
 * emote whose file is not in the folder yet falls back to a neutral square
 * with its initial, which keeps the picker usable while the art is produced.
 */
export const EmoteIcon = ({ emote, size = 24, className }: EmoteIconProps) => {
  const custom = customEmoteUrl(emote);
  if (custom) {
    return (
      <img
        src={custom}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={className}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex select-none items-center justify-center rounded-[28%] bg-surface-2 font-semibold text-ink-3 uppercase',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5), lineHeight: 1 }}
    >
      {emote[0]}
    </span>
  );
};
