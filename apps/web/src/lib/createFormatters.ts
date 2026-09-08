const RATE_DECIMALS = 6;
const SIGNIFICANT_RATE_DECIMALS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const RELATIVE_DAY_LIMIT = 7;

export interface FormattedTimestamp {
  iso: string;
  text: string;
  title: string;
}

export interface Formatters {
  money(value: number): string;
  integer(value: number): string;
  rate(value: number): string;
  splitRate(value: number): { lead: string; tail: string };
  timestamp(isoTimestamp: string, now?: Date): FormattedTimestamp | null;
}

export function createFormatters(locale: string): Formatters {
  const money = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const rate = new Intl.NumberFormat(locale, {
    minimumFractionDigits: RATE_DECIMALS,
    maximumFractionDigits: RATE_DECIMALS,
    useGrouping: false,
  });
  const timeOnly = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });
  const dateAndTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'long' });
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
          lead += part.value.slice(0, SIGNIFICANT_RATE_DECIMALS);
          tail += part.value.slice(SIGNIFICANT_RATE_DECIMALS);
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
      const text =
        days === 0
          ? timeOnly.format(date)
          : Math.abs(days) < RELATIVE_DAY_LIMIT
            ? relative.format(days, 'day')
            : dateAndTime.format(date);

      return { iso: date.toISOString(), text, title: full.format(date) };
    },
  };
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
