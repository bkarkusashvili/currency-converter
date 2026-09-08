import { code as byAlpha, number as byNumeric } from 'currency-codes';
import { Currency } from './currency';
import { CurrencyCode } from './currency-code';

// ISO 4217 numeric codes are three digits and the table is keyed by the padded
// string, so ALL (8) has to be looked up as '008'. Monobank sends them as
// plain numbers, which is where the padding is lost.
const NUMERIC_DIGITS = 3;

export function alphaFromNumeric(numeric: number): CurrencyCode | undefined {
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return undefined;
  }

  return byNumeric(String(numeric).padStart(NUMERIC_DIGITS, '0'))?.code;
}

// One lookup for everything the currencies response needs. The table stores
// the numeric code as its padded string; the API answers with the number,
// which is the form ISO 4217 defines it in and the form the upstream sends.
export function describeCurrency(code: CurrencyCode): Currency | undefined {
  const entry = byAlpha(code);

  if (entry === undefined) {
    return undefined;
  }

  return {
    code: entry.code,
    numericCode: Number(entry.number),
    name: entry.currency,
  };
}
