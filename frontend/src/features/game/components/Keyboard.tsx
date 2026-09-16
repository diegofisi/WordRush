import { BackspaceIcon } from '@/shared/components/icons/GameIcons';
import type { Language } from '@/shared/contract';
import { cn } from '@/shared/lib/cn';

import { keyboardRows } from '../helpers/keyboard';
import type { KeyState } from '../models/game.model';

interface KeyboardProps {
  language: Language;
  keyStates: Record<string, KeyState>;
  /** Wording for a key that already carries a state; without it the colour is
   * the only signal and a screen reader never hears which letters are ruled out. */
  stateLabels: Record<KeyState, string>;
  disabled: boolean;
  enterLabel: string;
  backspaceLabel: string;
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  /** Phrase game: the purple FRASE key at the end of the last row. */
  phraseKey?: { label: string; disabled: boolean; onClick: () => void } | null;
  /** Phrase game: a grey letter is out of the phrase, its key is disabled. */
  disableGray?: boolean;
}

const stateClass: Record<KeyState, string> = {
  green: 'key-green',
  yellow: 'key-yellow',
  gray: 'key-gray',
  hint: 'key-hint',
};

export const Keyboard = ({
  language,
  keyStates,
  stateLabels,
  disabled,
  enterLabel,
  backspaceLabel,
  onLetter,
  onEnter,
  onBackspace,
  phraseKey = null,
  disableGray = false,
}: KeyboardProps) => {
  const rows = keyboardRows(language);
  const letterKey = (letter: string) => {
    const state = keyStates[letter];
    return (
      <button
        key={letter}
        type="button"
        disabled={disabled || (disableGray && state === 'gray')}
        // Only once the key carries a state: an untried key reads fine from its
        // own text, and an aria-label would replace that text for no gain.
        aria-label={state ? `${letter}, ${stateLabels[state]}` : undefined}
        onClick={() => onLetter(letter)}
        className={cn(
          'key min-w-0 flex-1 sm:flex-none sm:min-w-10 sm:px-2.5 disabled:opacity-60',
          state ? stateClass[state] : undefined,
        )}
      >
        {letter}
      </button>
    );
  };

  return (
    <div
      className="flex w-full flex-col items-stretch gap-1.5 sm:items-center"
      aria-label="keyboard"
    >
      {rows.map((row, rowIndex) => {
        const isLast = rowIndex === rows.length - 1;
        return (
          <div key={rowIndex} className="flex justify-center gap-1.25 sm:gap-1.5">
            {isLast ? (
              <button
                type="button"
                disabled={disabled}
                onClick={onEnter}
                className="key key-enter min-w-0 flex-[1.6] sm:flex-none sm:min-w-19 disabled:opacity-60"
              >
                {enterLabel}
              </button>
            ) : null}
            {row.map(letterKey)}
            {isLast ? (
              <button
                type="button"
                disabled={disabled}
                aria-label={backspaceLabel}
                onClick={onBackspace}
                className="key min-w-0 flex-[1.4] sm:flex-none sm:min-w-15 disabled:opacity-60"
              >
                <BackspaceIcon size={22} />
              </button>
            ) : null}
            {isLast && phraseKey ? (
              <button
                type="button"
                disabled={phraseKey.disabled}
                onClick={phraseKey.onClick}
                className="key key-phrase min-w-0 flex-[1.6] sm:flex-none sm:min-w-19 disabled:opacity-60"
              >
                {phraseKey.label}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
