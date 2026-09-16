import type { GameKind } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

interface GameSwitchProps {
  t: Dictionary['home'];
  game: GameKind;
  onChange: (game: GameKind) => void;
}

const OPTIONS: readonly GameKind[] = ['wordle', 'phrase'];

/**
 * Word / Guess the phrase in the top bar of the home page: a pill with a
 * thumb that slides between the two, in the app's own colours (green for the
 * word, yellow for the phrase, on the white surface of the logo tiles).
 */
export const GameSwitch = ({ t, game, onChange }: GameSwitchProps) => {
  const phrase = game === 'phrase';
  return (
    <div
      role="radiogroup"
      aria-label={t.game}
      className="relative grid h-10 grid-cols-2 items-stretch rounded-full border border-line bg-surface p-1"
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full transition-[transform,background-color] duration-250 ease-[cubic-bezier(0.34,1.4,0.64,1)] motion-reduce:transition-none',
          phrase ? 'translate-x-full bg-yellow' : 'translate-x-0 bg-green',
        )}
      />
      {OPTIONS.map((option) => {
        const active = option === game;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={cn(
              'relative z-10 rounded-full px-3 text-[13px] font-bold whitespace-nowrap transition-colors duration-200',
              active
                ? option === 'phrase'
                  ? 'text-[#1c1a17]'
                  : 'text-white'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            {option === 'wordle' ? t.gameWordle : t.gamePhrase}
          </button>
        );
      })}
    </div>
  );
};
