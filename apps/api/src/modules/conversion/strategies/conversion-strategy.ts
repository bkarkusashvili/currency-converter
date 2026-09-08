import type Big from 'big.js';
import { CurrencyCode } from '../../rates/domain/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';
import { ConversionStrategyName } from './conversion-strategy-name';

// One way of pricing a pair. An implementation answers `supports` for the pairs
// it can price from the snapshot it is handed and returns the `to`-per-`from`
// rate for those, unrounded: rounding belongs to the edge that publishes the
// number, not to a step that another rate may still be multiplied by.
//
// `supports` is the whole precondition of `rate`, so a strategy that answers
// true must be able to produce the rate, and the resolver never has to know
// what any of them look at.
export interface ConversionStrategy {
  readonly name: ConversionStrategyName;

  supports(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): boolean;

  rate(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): Big;
}
