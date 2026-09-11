import type { Emote } from '@/shared/contract';

interface EmoteIconProps {
  emote: Emote;
  size?: number;
  className?: string;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** The six game emotes, traced from docs/design/Main.dc.html (stroke SVGs, 24 px grid). */
export const EmoteIcon = ({ emote, size = 24, className }: EmoteIconProps) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', className, ...base };
  switch (emote) {
    case 'smile':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14c1 1.5 2.4 2 4 2s3-.5 4-2" />
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
        </svg>
      );
    case 'laugh':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 13a4 4 0 0 0 8 0z" fill="currentColor" />
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
        </svg>
      );
    case 'angry':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 16c1-1.5 2.4-2 4-2s3 .5 4 2" />
          <path d="m8 8 2.5 1.5" />
          <path d="M16 8l-2.5 1.5" />
        </svg>
      );
    case 'cry':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 16c1-1 2-1.5 3-1.5s2 .5 3 1.5" />
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
          <path
            d="M16 11c0 1.2-.8 2-1 2.6-.3.6.4 1.4 1 1.4s1.3-.8 1-1.4c-.2-.6-1-1.4-1-2.6z"
            fill="currentColor"
          />
        </svg>
      );
    case 'shock':
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="15" r="2" />
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
        </svg>
      );
    case 'thumbs':
      return (
        <svg {...props} aria-hidden="true">
          <path d="M7 11v9H3v-9z" />
          <path d="M7 11l4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7" />
        </svg>
      );
  }
};
