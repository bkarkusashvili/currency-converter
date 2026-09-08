export const MAX_AMOUNT = 1_000_000_000_000;

export type AmountErrorCode = 'empty' | 'notANumber' | 'notPositive' | 'tooLarge';

export type ParsedAmount = { ok: true; value: number } | { ok: false; error: AmountErrorCode };

/**
 * One explicit rule for grouped input:
 * - whitespace is stripped;
 * - with both `,` and `.` present, the last one is the decimal mark and the other groups thousands;
 * - a separator repeated more than once groups thousands;
 * - a single `,` before exactly three trailing digits groups thousands (`1,000` → 1000);
 * - any other single `,` is the decimal mark (`1,5` → 1.5), as is any single `.`;
 * - a grouping separator must actually separate groups of three digits, so `1..5` is not a number.
 */
export function parseAmount(input: string): ParsedAmount {
  const compact = input.replace(/\s/g, '');
  if (compact === '') {
    return { ok: false, error: 'empty' };
  }

  const negative = compact.startsWith('-');
  const unsigned = compact.replace(/^[+-]/, '');
  const normalised = normaliseSeparators(unsigned);

  if (normalised === null || !/^\d+(?:\.\d+)?$/.test(normalised)) {
    return { ok: false, error: 'notANumber' };
  }

  const value = Number(normalised) * (negative ? -1 : 1);

  if (!Number.isFinite(value)) {
    return { ok: false, error: 'notANumber' };
  }
  if (value <= 0) {
    return { ok: false, error: 'notPositive' };
  }
  if (value > MAX_AMOUNT) {
    return { ok: false, error: 'tooLarge' };
  }

  return { ok: true, value };
}

function normaliseSeparators(text: string): string | null {
  const commas = occurrences(text, ',');
  const dots = occurrences(text, '.');

  if (commas > 0 && dots > 0) {
    const decimal = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    const cut = text.lastIndexOf(decimal);
    const whole = text.slice(0, cut);
    const fraction = text.slice(cut + 1);

    return isGrouped(whole, grouping) ? `${stripAll(whole, grouping)}.${fraction}` : null;
  }

  if (commas > 1) {
    return isGrouped(text, ',') ? stripAll(text, ',') : null;
  }
  if (dots > 1) {
    return isGrouped(text, '.') ? stripAll(text, '.') : null;
  }
  if (commas === 1) {
    return /,\d{3}$/.test(text) ? stripAll(text, ',') : text.replace(',', '.');
  }

  return text;
}

function isGrouped(text: string, separator: string): boolean {
  return new RegExp(`^\\d{1,3}(?:${escape(separator)}\\d{3})+$`).test(text);
}

function stripAll(text: string, separator: string): string {
  return text.split(separator).join('');
}

function occurrences(text: string, character: string): number {
  return text.split(character).length - 1;
}

function escape(separator: string): string {
  return separator === '.' ? '\\.' : separator;
}
