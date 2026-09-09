/** The air board 1c leaves between the trigger and the list it opens. */
export const POPOVER_GAP = 6;

/** How close to an edge the popover is allowed to come. */
export const VIEWPORT_MARGIN = 8;

/** What `getBoundingClientRect` gives, narrowed to the four numbers used here. */
export interface Rect {
  top: number;
  left: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PopoverPlacement {
  top: number;
  left: number;
  /** The popover opened upwards because there was no room below the trigger. */
  flipped: boolean;
}

/**
 * Where the popover goes, given where the trigger is and how big the popover
 * turned out to be. It is `position: fixed` — the converter card clips its own
 * overflow — so nothing but this function keeps it inside the window.
 *
 * Below the trigger and left-aligned with it by default; above it when the
 * bottom of the window has less room than the top; and never closer than
 * `VIEWPORT_MARGIN` to any edge, which is what a trigger near the right edge
 * or a short window needs. When neither side fits — a phone-height window
 * with the browser chrome out — the popover stays on screen and scrolls its
 * own list rather than hanging off the bottom.
 */
export function placePopover(trigger: Rect, panel: Rect, viewport: Viewport): PopoverPlacement {
  const spaceBelow = viewport.height - trigger.bottom - POPOVER_GAP - VIEWPORT_MARGIN;
  const spaceAbove = trigger.top - POPOVER_GAP - VIEWPORT_MARGIN;
  const flipped = panel.height > spaceBelow && spaceAbove > spaceBelow;

  const top = flipped ? trigger.top - POPOVER_GAP - panel.height : trigger.bottom + POPOVER_GAP;
  const left = trigger.left;

  return {
    top: clamp(top, viewport.height, panel.height),
    left: clamp(left, viewport.width, panel.width),
    flipped,
  };
}

/**
 * Inside the margin at both ends, and pinned to the near one when the popover
 * is wider or taller than the room there is — `Math.max` on the upper bound so
 * a window smaller than the popover does not push it off the top or the left.
 */
function clamp(value: number, extent: number, size: number): number {
  return Math.min(
    Math.max(value, VIEWPORT_MARGIN),
    Math.max(extent - size - VIEWPORT_MARGIN, VIEWPORT_MARGIN),
  );
}
