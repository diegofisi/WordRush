import { Volume2, VolumeX } from 'lucide-react';

import { useT } from '@/shared/i18n';
import { useUiStore } from '@/shared/stores/useUiStore';

/** Cues on/off, next to the theme. The choice is remembered across visits. */
export const SoundToggle = () => {
  const t = useT();
  const muted = useUiStore((state) => state.muted);
  const toggleMuted = useUiStore((state) => state.toggleMuted);
  const label = muted ? t.common.soundOn : t.common.soundOff;
  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={label}
      aria-pressed={!muted}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line bg-surface-2 text-ink transition-colors hover:bg-line"
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
};
