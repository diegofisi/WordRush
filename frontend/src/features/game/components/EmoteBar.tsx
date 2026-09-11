import { EmoteIcon } from '@/shared/components/icons/EmoteIcon';
import { EMOTES, type Emote } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

interface EmoteBarProps {
  t: Dictionary;
  disabled: boolean;
  onEmote: (emote: Emote) => void;
  variant?: 'card' | 'row';
}

/** The six reactions; disabled for the 3 s local cooldown. */
export const EmoteBar = ({ t, disabled, onEmote, variant = 'card' }: EmoteBarProps) => (
  <div
    role="group"
    aria-label={t.game.reactions}
    className={cn(
      'flex items-center justify-between gap-1.5',
      variant === 'card' && 'rounded-2xl border border-line bg-surface px-3 py-2.5',
    )}
  >
    {EMOTES.map((emote) => (
      <button
        key={emote}
        type="button"
        disabled={disabled}
        aria-label={t.emotes[emote]}
        title={disabled ? t.game.reactionCooldown : t.emotes[emote]}
        onClick={() => onEmote(emote)}
        className={cn(
          'flex items-center justify-center text-ink transition-[transform,opacity] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
          variant === 'card'
            ? 'h-10 w-10 rounded-[10px] bg-surface-2 hover:bg-line'
            : 'h-9 min-w-0 flex-1 rounded-[7px] border border-line bg-surface',
        )}
      >
        <EmoteIcon emote={emote} size={variant === 'card' ? 24 : 22} />
      </button>
    ))}
  </div>
);
