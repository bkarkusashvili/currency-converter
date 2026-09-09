/**
 * jsdom has no `matchMedia` and no layout, so a component that renders one
 * thing above 640px and another below it has no width to read. This installs
 * the smallest stand-in that answers the one query `useIsCompact` asks, with
 * the wide viewport as the default every suite starts from.
 */
let compact = false;

type Listener = (event: MediaQueryListEvent) => void;

const listeners = new Set<Listener>();

function mediaQueryList(query: string): MediaQueryList {
  return {
    media: query,
    get matches() {
      return compact;
    },
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
}

export function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: mediaQueryList,
  });
}

/** Puts the suite on a narrow viewport — the bottom sheet, the stacked panes. */
export function setCompactViewport(next: boolean): void {
  compact = next;
  for (const listener of listeners) {
    listener({ matches: next } as MediaQueryListEvent);
  }
}

export function resetViewport(): void {
  compact = false;
  listeners.clear();
}
