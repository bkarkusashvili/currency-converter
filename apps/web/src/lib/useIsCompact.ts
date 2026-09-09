import { useSyncExternalStore } from 'react';

/**
 * The one breakpoint the design switches layout at (§2.4): 640px, which is
 * Tailwind's `sm:`. Written in rem so a reader who has scaled their text gets
 * the sheet at the width the popover would actually stop fitting at.
 */
const COMPACT_QUERY = '(max-width: 39.9375rem)';

function query(): MediaQueryList | null {
  // `matchMedia` is missing in jsdom and in any non-browser render, and the
  // wide layout is the one that degrades gracefully: a popover that opens
  // where a sheet was wanted is still a usable list.
  return typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT_QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const media = query();
  media?.addEventListener('change', onChange);

  return () => media?.removeEventListener('change', onChange);
}

function isCompact(): boolean {
  return query()?.matches ?? false;
}

/**
 * Whether the viewport is below the collapse breakpoint, as a subscription
 * rather than a one-off read: rotating a phone changes the answer, and the
 * currency picker is a different component on each side of it.
 */
export function useIsCompact(): boolean {
  return useSyncExternalStore(subscribe, isCompact, () => false);
}
