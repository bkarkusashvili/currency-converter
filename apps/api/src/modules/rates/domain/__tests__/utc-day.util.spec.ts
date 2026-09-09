import { toUtcDay, utcWindowStart } from '../utc-day.util';

describe('toUtcDay', () => {
  it('keys an instant by its UTC day', () => {
    expect(toUtcDay(new Date('2026-09-08T12:00:00.000Z'))).toBe('2026-09-08');
  });

  // The case a local-time key gets wrong: this instant is the ninth in Kyiv and
  // the eighth in UTC, and two instances in two regions keying it differently
  // is the second document per day the contract says never exists.
  it('keys the last minutes of a UTC day to that day, wherever it runs', () => {
    expect(toUtcDay(new Date('2026-09-08T23:59:59.999Z'))).toBe('2026-09-08');
    expect(toUtcDay(new Date('2026-09-09T00:00:00.000Z'))).toBe('2026-09-09');
  });
});

describe('utcWindowStart', () => {
  const now = new Date('2026-09-08T06:00:00.000Z');

  // A window of one is today alone: "the last day" is not "yesterday as well".
  it('counts today as the first day of the window', () => {
    expect(utcWindowStart(1, now)).toBe('2026-09-08');
  });

  it('reaches back one day short of the window', () => {
    expect(utcWindowStart(7, now)).toBe('2026-09-02');
  });

  // The arithmetic is on instants, so nothing here has to know how long a month
  // is — which is the bug a day-of-month subtraction has at every boundary.
  it('crosses a month boundary', () => {
    expect(utcWindowStart(10, new Date('2026-03-05T06:00:00.000Z'))).toBe(
      '2026-02-24',
    );
  });

  it('crosses a leap day', () => {
    expect(utcWindowStart(3, new Date('2024-03-01T06:00:00.000Z'))).toBe(
      '2024-02-28',
    );
  });
});
