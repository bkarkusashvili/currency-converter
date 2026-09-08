import { CurrencyCode } from './currency-code';

export interface ExchangeRate {
  // Monobank's currencyCodeA: one unit of it costs the quoted amount of quote.
  base: CurrencyCode;
  // Monobank's currencyCodeB.
  quote: CurrencyCode;
  // The bank buys base and pays quote.
  buy?: number;
  // The bank sells base and receives quote.
  sell?: number;
  // Mid rate, published for the pairs that have no spread.
  cross?: number;
  // ISO timestamp of the upstream quote, not of the fetch.
  date: string;
}
