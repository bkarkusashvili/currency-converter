import { useLayoutEffect } from 'react';

/**
 * Holds the page still while `active`. A modal surface that lets the page
 * scroll behind it takes the wheel and the touch drag away from the list it is
 * showing, and on a phone the sheet's own scroll runs out into the document
 * under it.
 *
 * The body's padding takes up whatever the scrollbar was occupying, so hiding
 * it does not shift the page sideways under the scrim — measured rather than
 * assumed, because an overlay scrollbar occupies nothing and needs no padding.
 * Both properties are put back exactly as they were found, inline styles
 * included, so two of these in sequence cannot leave the page locked.
 */
export function useScrollLock(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    const overflow = body.style.overflow;
    const paddingRight = body.style.paddingRight;

    body.style.overflow = 'hidden';
    if (scrollbar > 0) {
      body.style.paddingRight = `${String(scrollbar)}px`;
    }

    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = paddingRight;
    };
  }, [active]);
}
