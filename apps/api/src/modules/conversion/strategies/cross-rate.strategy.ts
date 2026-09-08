import { Injectable } from '@nestjs/common';
import type Big from 'big.js';
import { BASE_CURRENCY } from '../../rates/domain/base-currency';
import { CurrencyCode } from '../../rates/domain/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';
import { ConversionStrategy } from './conversion-strategy';
import { ConversionStrategyName } from './conversion-strategy-name';
import { directionalRate } from './directional-rate';

// Two legs through the currency every published pair has in common, which for
// a Ukrainian bank's rates is the hryvnia: sell the source currency for it,
// buy the target with it. Both legs are the §5 rule, so the spread is paid
// twice and the answer is worse than a published pair — which is why this is
// the last strategy tried rather than the general case.
//
// Both legs come back from `directionalRate` as `Money` values and big.js
// carries the constructor through an operation, so the product is one too and
// the composition never touches the global precision either.
@Injectable()
export class CrossRateStrategy implements ConversionStrategy {
  readonly name: ConversionStrategyName = 'cross';

  // A currency has a path to itself through the base currency, and taking it
  // would answer 0.989 for USD to USD. Identity prices that pair, and declining
  // it here is what keeps the chain's order a preference rather than a
  // correctness condition.
  price(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): Big | undefined {
    if (from === to) {
      return undefined;
    }

    const intoBase = directionalRate(from, BASE_CURRENCY, rates);
    const outOfBase = directionalRate(BASE_CURRENCY, to, rates);

    return intoBase === undefined || outOfBase === undefined
      ? undefined
      : intoBase.times(outOfBase);
  }
}
