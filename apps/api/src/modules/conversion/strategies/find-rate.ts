import { CurrencyCode } from '../../../common/currency/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';

// A snapshot is a handful of pairs, so the lookup is a scan; it is a function
// of its own so that "the pair the upstream published for base/quote" is
// spelled once and every strategy asks the same question.
export function findRate(
  rates: readonly ExchangeRate[],
  base: CurrencyCode,
  quote: CurrencyCode,
): ExchangeRate | undefined {
  return rates.find((rate) => rate.base === base && rate.quote === quote);
}
