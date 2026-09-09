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
  it('groups money to two decimals and a rate to as many as it needs', () => {
    expect(formatters.money(4143.5)).toBe('4,143.50');
    expect(formatters.integer(1_000_000_000_000)).toBe('1,000,000,000,000');
    expect(formatters.rate(44.35)).toBe('44.35');
    expect(formatters.rate(0.022548)).toBe('0.022548');
    expect(formatters.rate(41)).toBe('41.00');
  });

  it('reads the field separators off the locale rather than assuming them', () => {
    expect(formatters.separators).toEqual({ group: ',', decimal: '.' });
    expect(createFormatters('de-DE').separators).toEqual({ group: '.', decimal: ',' });
  });

  it('splits a rate after two significant decimals', () => {
    expect(formatters.splitRate(4.257112)).toEqual({ lead: '4.25', tail: '7112' });
    expect(formatters.splitRate(0.847312)).toEqual({ lead: '0.84', tail: '7312' });
  });

  it('counts a sub-1 rate from its first digit, not from the decimal point', () => {
    // `0.00` is not a rate; dimming from there would dim the whole number.
    expect(formatters.splitRate(0.002255)).toEqual({ lead: '0.0022', tail: '55' });
    expect(formatters.splitRate(0.000123)).toEqual({ lead: '0.00012', tail: '3' });
    // Nothing significant to find, so nothing is dimmed.
    expect(formatters.splitRate(0.0001)).toEqual({ lead: '0.0001', tail: '' });
  });
});

describe('timestamp formatting', () => {
  it('shows only the time for a value from today', () => {
    const stamp = formatters.timestamp(daysBefore(0), now);

    expect(stamp).not.toBeNull();
    expect(stamp?.text).toMatch(/^\d{1,2}:\d{2}/);
    expect(stamp?.title).toContain('2026');
  });

  it('reads the clock as 24 hours, which is what the boards show', () => {
    const evening = new Date(now);
    evening.setHours(21, 45, 0, 0);

    expect(formatters.timestamp(evening.toISOString(), now)?.text).toBe('21:45');
    // Even in a locale that would have picked one, there is no am/pm to wrap.
    expect(formatters.timestamp('2024-03-05T12:00:00.000Z', now)?.text).not.toMatch(/[AP]M/i);
    expect(formatters.timestamp('2024-03-05T12:00:00.000Z', now)?.title).not.toMatch(/[AP]M/i);
  });

  it('says how many days ago a recent value is', () => {
    expect(formatters.timestamp(daysBefore(1), now)?.text).toBe('yesterday');
    expect(formatters.timestamp(daysBefore(2), now)?.text).toBe('2 days ago');
  });

  it('names the shape it produced, so a sentence can pick its preposition', () => {
    expect(formatters.timestamp(daysBefore(0), now)?.kind).toBe('clock');
    expect(formatters.timestamp(daysBefore(1), now)?.kind).toBe('relative');
    expect(formatters.timestamp(daysBefore(30), now)?.kind).toBe('calendar');
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

describe('archived day formatting', () => {
  it('writes the day first wherever the locale would have written the month first', () => {
    // `en-US` would say `Sep 9, 2026`; the archive line reads the same
    // everywhere, so the parts are put back in one order (§6.15).
    expect(formatters.archivedDay('2026-09-09', 'dayMonthYear')).toBe('9 Sep 2026');
    expect(formatters.archivedDay('2026-09-09')).toBe('9 Sep');
    expect(formatters.archivedDay('2026-09-09', 'day')).toBe('9');
    expect(formatters.archivedDay('2026-09-07', 'full')).toBe('Mon 7 Sep');
  });

  it('reads a day in UTC, which is the day the archive keyed it by', () => {
    // Late enough in the day to be tomorrow anywhere east of Greenwich, and
    // early enough to be yesterday anywhere west of it.
    expect(formatters.archivedDay('2026-09-07T20:45:00.000Z', 'dayMonthYear')).toBe('7 Sep 2026');
    expect(formatters.archivedDay('2026-09-07T02:15:00.000Z', 'dayMonthYear')).toBe('7 Sep 2026');
  });

  it('returns nothing for a value that is not a day', () => {
    expect(formatters.archivedDay('not-a-day')).toBeNull();
  });
});

describe('percentage formatting', () => {
  it('reports a proportion to one place', () => {
    expect(formatters.percent(0.003167)).toBe('0.3%');
    expect(formatters.percent(0)).toBe('0.0%');
    expect(formatters.percent(0.1234)).toBe('12.3%');
  });
});
