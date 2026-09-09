/**
 * The two TTLs docs/architecture.md §4 documents for the Redis keys, and the
 * defaults the deployed API runs with: `RATES_CACHE_TTL_SECONDS` 300 and
 * `RATES_STALE_TTL_SECONDS` 86400.
 *
 * `GET /api/v1/rates` publishes neither an expiry nor a remaining TTL — only
 * `source` and `fetchedAt` — so everything below is worked out in the browser
 * from the fetch time, and the page says as much next to the numbers (§5.3).
 */
export const FRESH_TTL_MS = 5 * 60 * 1000;

export const FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

export interface SnapshotTtl {
  ageMs: number;
  /** Milliseconds before the fresh key expires; zero once it has. */
  freshRemainingMs: number;
  fallbackRemainingMs: number;
  /** How much of each window has been spent, 0 to 1 — what the meter fills. */
  freshElapsed: number;
  fallbackElapsed: number;
  /** The fresh key is gone, so the next conversion refetches or falls back. */
  isStale: boolean;
  /** Both keys are gone: nothing is left to fall back on. */
  isExpired: boolean;
}

/**
 * What the two cache keys have left, given when the snapshot was fetched.
 * `null` for a timestamp that is not one, so a caller renders "unknown" rather
 * than arithmetic on a NaN.
 */
export function snapshotTtl(fetchedAt: string, now: Date = new Date()): SnapshotTtl | null {
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.getTime())) {
    return null;
  }

  // A clock that is behind the API's would otherwise report a negative age and
  // a fresh key with more than its whole TTL left.
  const ageMs = Math.max(now.getTime() - fetched.getTime(), 0);

  return {
    ageMs,
    freshRemainingMs: Math.max(FRESH_TTL_MS - ageMs, 0),
    fallbackRemainingMs: Math.max(FALLBACK_TTL_MS - ageMs, 0),
    freshElapsed: Math.min(ageMs / FRESH_TTL_MS, 1),
    fallbackElapsed: Math.min(ageMs / FALLBACK_TTL_MS, 1),
    isStale: ageMs >= FRESH_TTL_MS,
    isExpired: ageMs >= FALLBACK_TTL_MS,
  };
}

export interface DurationParts {
  unit: 'seconds' | 'minutes' | 'hours';
  seconds: number;
  minutes: number;
  hours: number;
}

/** A duration split the way the boards write it: `44 s`, `2 min`, `1 h 27 min`. */
export function durationParts(ms: number): DurationParts {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);

  return {
    unit: totalMinutes === 0 ? 'seconds' : hours === 0 ? 'minutes' : 'hours',
    seconds: totalSeconds % 60,
    minutes: totalMinutes % 60,
    hours,
  };
}

/**
 * A countdown, as a clock: `2:54` under an hour and `23:58` over it, which is
 * how the fresh key and the fallback key are drawn on board 2a.
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0 ? `${String(hours)}:${pad(minutes)}` : `${String(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
