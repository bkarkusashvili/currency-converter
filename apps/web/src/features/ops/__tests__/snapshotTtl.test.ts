import { describe, expect, it } from 'vitest';
import {
  durationParts,
  FALLBACK_TTL_MS,
  formatCountdown,
  FRESH_TTL_MS,
  snapshotTtl,
} from '../lib/snapshotTtl';

const FETCHED_AT = '2026-09-09T14:30:04.000Z';

function at(msAfterFetch: number): Date {
  return new Date(new Date(FETCHED_AT).getTime() + msAfterFetch);
}

describe('snapshotTtl', () => {
  it('counts both keys down from the moment the snapshot was fetched', () => {
    // The state board 2a draws: three minutes six seconds into a five-minute key.
    const ttl = snapshotTtl(FETCHED_AT, at(2 * 60_000 + 6_000));

    expect(formatCountdown(ttl?.freshRemainingMs ?? 0)).toBe('2:54');
    expect(formatCountdown(ttl?.fallbackRemainingMs ?? 0)).toBe('23:57');
    expect(ttl?.isStale).toBe(false);
    expect(ttl?.isExpired).toBe(false);
  });

  it('reports the share of each window already spent, which is what the meter fills', () => {
    const ttl = snapshotTtl(FETCHED_AT, at(2 * 60_000 + 6_000));

    expect(Math.round((ttl?.freshElapsed ?? 0) * 100)).toBe(42);
    expect(Math.round((ttl?.fallbackElapsed ?? 0) * 100)).toBe(0);
  });

  it('calls the fresh key stale the second it expires, and stops there', () => {
    expect(snapshotTtl(FETCHED_AT, at(FRESH_TTL_MS - 1))?.isStale).toBe(false);

    const stale = snapshotTtl(FETCHED_AT, at(FRESH_TTL_MS + 60_000));
    expect(stale?.isStale).toBe(true);
    expect(stale?.freshRemainingMs).toBe(0);
    expect(stale?.freshElapsed).toBe(1);
    expect(stale?.isExpired).toBe(false);
  });

  it('says when there is nothing left to fall back on either', () => {
    const gone = snapshotTtl(FETCHED_AT, at(FALLBACK_TTL_MS + 1));

    expect(gone?.isExpired).toBe(true);
    expect(gone?.fallbackRemainingMs).toBe(0);
  });

  it('treats a clock that is behind the API as a snapshot fetched just now', () => {
    const ahead = snapshotTtl(FETCHED_AT, at(-60_000));

    expect(ahead?.ageMs).toBe(0);
    expect(ahead?.freshRemainingMs).toBe(FRESH_TTL_MS);
  });

  it('has nothing to derive from a timestamp that is not one', () => {
    expect(snapshotTtl('not a date')).toBeNull();
  });
});

describe('durationParts', () => {
  it('splits an age the way the boards write it', () => {
    expect(durationParts(44_000)).toMatchObject({ unit: 'seconds', seconds: 44 });
    expect(durationParts(2 * 60_000)).toMatchObject({ unit: 'minutes', minutes: 2 });
    expect(durationParts(87 * 60_000)).toMatchObject({ unit: 'hours', hours: 1, minutes: 27 });
  });

  it('has no negative parts to render', () => {
    expect(durationParts(-5_000)).toMatchObject({ unit: 'seconds', seconds: 0 });
  });
});

describe('formatCountdown', () => {
  it('is minutes and seconds under the hour and hours and minutes over it', () => {
    expect(formatCountdown(174_000)).toBe('2:54');
    expect(formatCountdown(9_000)).toBe('0:09');
    expect(formatCountdown(86_280_000)).toBe('23:58');
  });

  it('bottoms out at zero rather than counting past it', () => {
    expect(formatCountdown(-1)).toBe('0:00');
  });
});
