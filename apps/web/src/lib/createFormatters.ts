/**
 * The grouping and decimal marks of a locale. Declared here because
 * `createFormatters` is what reads them off `Intl`; the converter's amount
 * field is a consumer of them, not their owner.
 */
export interface AmountSeparators {
  /** The thousands separator of the active locale; `''` for a locale that does not group. */
  group: string;
  decimal: string;
}

/** §3 publishes an effective rate to six places; a rate never needs more. */
const RATE_DECIMALS = 6;
const MIN_RATE_DECIMALS = 2;
const SIGNIFICANT_RATE_DECIMALS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const RELATIVE_DAY_LIMIT = 7;

/**
 * Which shape `text` took. A sentence in front of it needs a preposition for a
 * clock time and a date and none at all for "yesterday", and only the formatter
 * knows which one it produced.
 */
export type TimestampKind = 'clock' | 'relative' | 'calendar';

export interface FormattedTimestamp {
  iso: string;
  text: string;
  title: string;
  kind: TimestampKind;
}

export interface Formatters {
  money(value: number): string;
  integer(value: number): string;
  rate(value: number): string;
  splitRate(value: number): { lead: string; tail: string };
  timestamp(isoTimestamp: string, now?: Date): FormattedTimestamp | null;
  /** The grouping and decimal marks of this locale, for the amount field to reuse. */
  separators: AmountSeparators;
}

export function createFormatters(locale: string): Formatters {
  const money = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  // Trailing zeros are noise on a rate — `44.35` is the published number and
  // `44.350000` only looks like more precision than Monobank quoted.
  const rate = new Intl.NumberFormat(locale, {
    minimumFractionDigits: MIN_RATE_DECIMALS,
    maximumFractionDigits: RATE_DECIMALS,
  });
  // The clock is 24-hour whatever the locale would have picked: it is what the
  // design draws, and it is two characters narrower on a line that gets one
  // line on a phone.
  const timeOnly = new Intl.DateTimeFormat(locale, { timeStyle: 'short', hour12: false });
  const dateAndTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  });
  const full = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'long',
    hour12: false,
  });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  return {
    money: (value) => money.format(value),
    integer: (value) => integer.format(value),
    rate: (value) => rate.format(value),

    splitRate(value) {
      let lead = '';
      let tail = '';
      for (const part of rate.formatToParts(value)) {
        if (part.type === 'fraction') {
          const cut = significantThrough(part.value, value);
          lead += part.value.slice(0, cut);
          tail += part.value.slice(cut);
        } else if (tail === '') {
          lead += part.value;
        } else {
          tail += part.value;
        }
      }
      return { lead, tail };
    },

    timestamp(isoTimestamp, now = new Date()) {
      const date = new Date(isoTimestamp);
      if (Number.isNaN(date.getTime())) {
        return null;
      }

      const days = calendarDaysBetween(now, date);
      const kind: TimestampKind =
        days === 0 ? 'clock' : Math.abs(days) < RELATIVE_DAY_LIMIT ? 'relative' : 'calendar';
      const text =
        kind === 'clock'
          ? timeOnly.format(date)
          : kind === 'relative'
            ? relative.format(days, 'day')
            : dateAndTime.format(date);

      return { iso: date.toISOString(), text, title: full.format(date), kind };
    },

    separators: separatorsOf(integer),
  };
}

/**
 * How much of the fraction is the number the reader came for. Two decimals for
 * a rate of one or more, but a rate below one carries no information until its
 * leading zeros are past: dimming everything after `0.00` of `0.002255` dims
 * the whole rate, so the count starts at the first digit that is not a zero.
 */
function significantThrough(fraction: string, value: number): number {
  if (Math.abs(value) >= 1) {
    return SIGNIFICANT_RATE_DECIMALS;
  }

  const firstSignificant = fraction.search(/[1-9]/);
  return firstSignificant === -1 ? fraction.length : firstSignificant + SIGNIFICANT_RATE_DECIMALS;
}

/**
 * Read off a formatted number rather than hardcoded per language, so the field
 * groups the way every other number on the page does.
 */
function separatorsOf(format: Intl.NumberFormat): AmountSeparators {
  const parts = new Intl.NumberFormat(format.resolvedOptions().locale, {
    minimumFractionDigits: 1,
  }).formatToParts(1111.1);

  return {
    group: parts.find((part) => part.type === 'group')?.value ?? '',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
  };
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
