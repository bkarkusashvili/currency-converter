import { toUtcDay, utcDayAge, utcWindowStart } from '../utc-day.util';

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

describe('utcDayAge', () => {
  const now = new Date('2026-09-08T06:00:00.000Z');

  // The fallback ceiling is a number of days, so today has to be nought of them
  // rather than a fraction: the clock time of either side never enters into it.
  it('reports today as no days old, whatever time of day it is', () => {
    expect(utcDayAge('2026-09-08', now)).toBe(0);
    expect(utcDayAge('2026-09-08', new Date('2026-09-08T23:59:59.999Z'))).toBe(
      0,
    );
  });

  it('counts whole days back', () => {
    expect(utcDayAge('2026-09-01', now)).toBe(7);
  });

  // Same reason `utcWindowStart` does its arithmetic on instants: nothing here
  // has to know how long a month is.
  it('crosses a month boundary', () => {
    expect(utcDayAge('2026-02-24', new Date('2026-03-05T06:00:00.000Z'))).toBe(
      9,
    );
  });

  // A day dated ahead of the clock is negative rather than nought, which keeps
  // it inside any ceiling: the window read is what refuses a future day, and a
  // fallback tier refusing one would be refusing the freshest thing it has.
  it('reports a day dated ahead of the clock as negative', () => {
    expect(utcDayAge('2026-09-09', now)).toBe(-1);
  });
});
