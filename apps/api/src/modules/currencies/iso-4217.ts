import { code as byAlpha, number as byNumeric } from 'currency-codes';
import { CurrencyCode } from '../rates/domain/currency-code';

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

export function currencyName(code: CurrencyCode): string | undefined {
  return byAlpha(code)?.currency;
}
