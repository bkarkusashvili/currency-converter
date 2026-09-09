/**
 * The windows the archive can answer for. 90 is the retention itself: a wider
 * window is one the API answers `400` to rather than one it answers short
 * (docs/architecture.md §3).
 */
export const RANGE_DAYS = [7, 30, 90] as const;

export type RangeDays = (typeof RANGE_DAYS)[number];

/** What the panel opens on, and the API's own default for the route. */
export const DEFAULT_RANGE: RangeDays = 7;
