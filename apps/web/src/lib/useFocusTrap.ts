import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Tab and Shift+Tab stay inside `container` while `active`. The bottom sheet
 * and the clear-cache dialog are both modal surfaces drawn over the page, so
 * they share one implementation rather than each growing its own.
 *
 * What this hook deliberately does not do is put focus back afterwards: which
 * control a closed surface hands focus to is part of what the surface means —
 * the picker returns to its trigger even when a row was clicked — so each one
 * says it in its own close path rather than inheriting a guess from here.
 */
export function useFocusTrap(container: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || container.current === null) {
        return;
      }

      const focusable = focusableWithin(container.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        return;
      }

      const current = document.activeElement;

      // Only the two ends need catching; everything between them is the
      // browser's own order, which is the order a reader expects.
      if (event.shiftKey && (current === first || !container.current.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [container, active]);
}
