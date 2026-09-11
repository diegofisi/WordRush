import { cn } from '@/shared/lib/cn';
import { initialOf } from '@/shared/lib/format';

import type { AvatarTone as Tone } from '@/shared/lib/avatarTone';

interface AvatarProps {
  name: string;
  tone?: Tone;
  size?: number;
  className?: string;
}

const tones: Record<Tone, string> = {
  accent: 'bg-accent text-white',
  green: 'bg-green text-white',
  neutral: 'bg-key text-ink',
  yellow: 'bg-yellow text-tile-ink-dark',
  ink: 'bg-ink text-on-ink',
  red: 'bg-red text-white',
};

export const Avatar = ({ name, tone = 'neutral', size = 30, className }: AvatarProps) => (
  <div
    aria-hidden="true"
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-bold',
      tones[tone],
      className,
    )}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
  >
    {initialOf(name)}
  </div>
);
