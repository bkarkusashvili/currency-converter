import { BASE_CURRENCY } from '../rates/domain/base-currency';
import { CurrencyCode } from '../rates/domain/currency-code';
import { ExchangeRate } from '../rates/domain/exchange-rate';
import { Currency } from './currency';
import { describeCurrency } from './iso-4217';

// Both sides of every pair, plus the base currency: a snapshot can consist of
// crosses between two foreign currencies, and UAH would then be convertible
// through every one of them while appearing in none.
//
// Sorted by code because the list is what a client renders in a picker, and
// ordered by whatever the upstream published is not an order. The codes are
// sorted before they are described: the default comparator is total over the
// alpha-3 strings and, unlike localeCompare, gives the same order whatever
// locale the container's ICU data resolves to.
export function collectCurrencies(rates: readonly ExchangeRate[]): Currency[] {
  const codes = new Set<CurrencyCode>([BASE_CURRENCY]);

  for (const rate of rates) {
    codes.add(rate.base);
    codes.add(rate.quote);
  }

  return (
    [...codes]
      .sort()
      .map(describeCurrency)
      // A code reached a snapshot by being mapped out of its numeric form, so
      // the table has it. Dropping the impossible miss is what keeps the
      // response free of a half-described currency without a non-null
      // assertion in source.
      .filter((currency) => currency !== undefined)
  );
}
