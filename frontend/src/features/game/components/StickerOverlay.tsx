import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import type { Dictionary } from '@/shared/i18n';

import type { StickerFlash } from '../models/game.model';

interface StickerOverlayProps {
  t: Dictionary;
  sticker: StickerFlash | null;
}

/** Art size of the phone overlay; the desktop feed shows the same sticker at 112. */
const STICKER_SIZE = 96;

/**
 * Phones have no live feed, so a sticker lands here instead: it floats above the
 * keyboard, bottom-right, for 2.5 s (the store clears it), with the sender's
 * name in a pill under it. The wrapper is absolute and `pointer-events-none`, so
 * nothing shifts and every key underneath stays usable; several stickers in a
 * row simply replace one another, latest wins.
 */
export const StickerOverlay = ({ t, sticker }: StickerOverlayProps) => (
  <div
    aria-live="polite"
    className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 flex justify-end"
  >
    {sticker ? (
      <div key={sticker.id} className="animate-sticker-flash flex flex-col items-center gap-1">
        <EmoteIcon
          emote={sticker.emote}
          size={STICKER_SIZE}
          label={t.emotes[sticker.emote]}
          className="drop-shadow-lg"
        />
        <span className="max-w-24 truncate rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-on-ink">
          {sticker.name}
        </span>
      </div>
    ) : null}
  </div>
);
