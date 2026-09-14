import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const MODAL = '[role="dialog"],[role="alertdialog"]';

/**
 * Keeps Tab inside `ref` while `active`, and hands focus back to whatever held
 * it before the dialog opened.
 *
 * `aria-modal="true"` tells a screen reader the rest of the page is out of
 * bounds, but it does not move the Tab key: without this a keyboard user tabs
 * straight out of the dialog and into the page behind the overlay, where they
 * can operate controls they cannot see.
 */
export const useFocusTrap = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
): void => {
  const lastOutside = useRef<HTMLElement | null>(null);

  /*
   * Where focus returns to cannot simply be read when the trap turns on: React
   * applies `autoFocus` during the commit, before any effect runs, so a dialog
   * that autofocuses its own button (ConfirmDialog does) has already taken
   * focus by then and the trigger is gone. So remember every focus that lands
   * outside a modal as it happens.
   *
   * The test is the role rather than `ref.current`, because refs attach from
   * the bottom up: the child's autoFocus fires while the container ref is still
   * null, and `contains` would wave it through.
   */
  useEffect(() => {
    const remember = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || el === document.body) return;
      if (el.closest(MODAL)) return;
      lastOutside.current = el;
    };
    remember();
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, []);

  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;

    // Fallback for the case the listener above never saw: focus that was moved
    // while the document itself was not focused fires no events at all.
    const current = document.activeElement;
    const returnTo =
      lastOutside.current ??
      (current instanceof HTMLElement && !container.contains(current) ? current : null);

    // A dialog that declares its own initial focus has it already; anything
    // else is still on the trigger behind the overlay, so pull focus in.
    if (!container.contains(document.activeElement)) {
      container.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      // Re-read on every Tab: a button that turns `disabled` while a save is in
      // flight has to drop out of the ring.
      const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        // Nothing left to focus: stay put rather than let Tab escape behind.
        event.preventDefault();
        return;
      }
      const focused = document.activeElement;
      if (!container.contains(focused)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture, so the game's window-level key handler cannot see the Tab first.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Never send focus to a node that left the DOM with the dialog.
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [ref, active]);
};
