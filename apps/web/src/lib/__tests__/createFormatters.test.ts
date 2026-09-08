import { describe, expect, it } from 'vitest';
import { createFormatters } from '../createFormatters';

const formatters = createFormatters('en-US');
const now = new Date('2026-09-08T12:00:00.000Z');

/** Local calendar days, so the expectations hold in every time zone. */
function daysBefore(days: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(9, 30, 0, 0);
  return date.toISOString();
}

describe('number formatting', () => {
  it('groups money to two decimals and rates to six', () => {
    expect(formatters.money(4143.5)).toBe('4,143.50');
    expect(formatters.integer(1_000_000_000_000)).toBe('1,000,000,000,000');
    expect(formatters.rate(41.435)).toBe('41.435000');
  });

  it('splits a rate after two significant decimals', () => {
    expect(formatters.splitRate(4.257112)).toEqual({ lead: '4.25', tail: '7112' });
  });
});

describe('timestamp formatting', () => {
  it('shows only the time for a value from today', () => {
    const stamp = formatters.timestamp(daysBefore(0), now);

    expect(stamp).not.toBeNull();
    expect(stamp?.text).toMatch(/^\d{1,2}:\d{2}/);
    expect(stamp?.title).toContain('2026');
  });

  it('says how many days ago a recent value is', () => {
    expect(formatters.timestamp(daysBefore(1), now)?.text).toBe('yesterday');
    expect(formatters.timestamp(daysBefore(2), now)?.text).toBe('2 days ago');
  });

  it('shows date and time once the value is older than a week', () => {
    const stamp = formatters.timestamp('2024-03-05T12:00:00.000Z', now);

    expect(stamp?.text).toContain('2024');
    expect(stamp?.iso).toBe('2024-03-05T12:00:00.000Z');
  });

  it('returns nothing for a value that is not a date', () => {
    expect(formatters.timestamp('not-a-date', now)).toBeNull();
  });
});
