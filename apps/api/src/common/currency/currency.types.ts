import { CurrencyCode } from './currency-code.types';

// A currency this API can quote, described from the ISO 4217 table rather than
// from the upstream: Monobank publishes numeric codes and no names.
export interface Currency {
  code: CurrencyCode;
  numericCode: number;
  name: string;
}
