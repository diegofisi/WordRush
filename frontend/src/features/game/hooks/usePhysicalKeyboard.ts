import { useEffect } from 'react';

import type { Language } from '@/shared/contract';

import { isLetterFor } from '../helpers/keyboard';

interface PhysicalKeyboardOptions {
  enabled: boolean;
  language: Language;
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

/** Routes physical key presses (letters incl. Ñ for ES rooms, Enter, Backspace) to the board. */
export const usePhysicalKeyboard = ({
  enabled,
  language,
  onLetter,
  onEnter,
  onBackspace,
}: PhysicalKeyboardOptions) => {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        onEnter();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        onBackspace();
      } else if (isLetterFor(event.key, language)) {
        event.preventDefault();
        onLetter(event.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, language, onLetter, onEnter, onBackspace]);
};
