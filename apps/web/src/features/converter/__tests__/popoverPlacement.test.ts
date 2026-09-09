import { describe, expect, it } from 'vitest';
import { placePopover, POPOVER_GAP, VIEWPORT_MARGIN, type Rect } from '../lib/popoverPlacement';

/** The popover as it actually measures: 320 wide, a little over 300 tall. */
const PANEL: Rect = { top: 0, left: 0, bottom: 0, width: 320, height: 317 };

function trigger(left: number, top: number, width = 299, height = 44): Rect {
  return { top, left, bottom: top + height, width, height };
}

const DESKTOP = { width: 1280, height: 800 };

describe('placePopover', () => {
  it('sits under the trigger and lines up with its left edge', () => {
    const placement = placePopover(trigger(480, 300), PANEL, DESKTOP);

    expect(placement).toEqual({ top: 344 + POPOVER_GAP, left: 480, flipped: false });
  });

  it('opens upwards when the list would run off the bottom', () => {
    // 700px of window with the trigger near the foot of it: 317 of popover
    // does not fit in what is left below, and does fit above.
    const placement = placePopover(trigger(480, 560), PANEL, { width: 1280, height: 700 });

    expect(placement.flipped).toBe(true);
    expect(placement.top).toBe(560 - POPOVER_GAP - PANEL.height);
  });

  it('stays below the trigger when there is no more room above it', () => {
    const placement = placePopover(trigger(480, 40), PANEL, { width: 1280, height: 380 });

    expect(placement.flipped).toBe(false);
  });

  it('pulls back from the right edge rather than hanging off it', () => {
    // 640 wide with the trigger in the right-hand pane: 320 of popover from
    // its left edge would be 25px past the window.
    const placement = placePopover(trigger(345, 300), PANEL, { width: 640, height: 800 });

    expect(placement.left).toBe(640 - PANEL.width - VIEWPORT_MARGIN);
    expect(placement.left + PANEL.width).toBeLessThanOrEqual(640 - VIEWPORT_MARGIN);
  });

  it('keeps the margin on the left when the window is narrower than the popover', () => {
    const placement = placePopover(trigger(4, 300), PANEL, { width: 300, height: 800 });

    expect(placement.left).toBe(VIEWPORT_MARGIN);
  });

  it('stays on screen on a window shorter than the popover, on either side', () => {
    const below = placePopover(trigger(480, 20), PANEL, { width: 1280, height: 260 });
    const above = placePopover(trigger(480, 200), PANEL, { width: 1280, height: 260 });

    for (const placement of [below, above]) {
      expect(placement.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
      expect(placement.top).toBeLessThanOrEqual(260 - VIEWPORT_MARGIN);
    }
  });
});
