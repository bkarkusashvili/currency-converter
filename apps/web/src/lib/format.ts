const LOCALE = 'en-US';

const moneyFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const RATE_DECIMALS = 6;
const SIGNIFICANT_DECIMALS = 2;

export function formatMoney(value: number): string {
  return moneyFormat.format(value);
}

export function formatRate(value: number): string {
  return value.toFixed(RATE_DECIMALS);
}

export function splitRate(value: number): { lead: string; tail: string } {
  const text = formatRate(value);
  const cut = text.indexOf('.') + 1 + SIGNIFICANT_DECIMALS;
  return { lead: text.slice(0, cut), tail: text.slice(cut) };
}

export function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? '—' : timeFormat.format(date);
}
