import { Injectable } from '@nestjs/common';
import Big from 'big.js';
import { BASE_CURRENCY } from '../../rates/domain/base-currency';
import { CurrencyCode } from '../../rates/domain/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';
import { ConversionStrategy } from './conversion-strategy';
import { ConversionStrategyName } from './conversion-strategy-name';
import { directionalRate } from './directional-rate';
import { requireRate } from './require-rate';

// Two legs through the currency every published pair has in common, which for
// a Ukrainian bank's rates is the hryvnia: sell the source currency for it,
// buy the target with it. Both legs are the §5 rule, so the spread is paid
// twice and the answer is worse than a published pair — which is why this is
// the last strategy tried rather than the general case.
function crossRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: readonly ExchangeRate[],
): Big | undefined {
  const intoBase = directionalRate(from, BASE_CURRENCY, rates);
  const outOfBase = directionalRate(BASE_CURRENCY, to, rates);

  return intoBase === undefined || outOfBase === undefined
    ? undefined
    : intoBase.times(outOfBase);
}

@Injectable()
export class CrossRateStrategy implements ConversionStrategy {
  readonly name: ConversionStrategyName = 'cross';

  // A currency has a path to itself through the base currency, and taking it
  // would answer 0.989 for USD to USD. Identity answers that pair, and saying
  // so here is what keeps the chain's order a preference rather than a
  // correctness condition.
  supports(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): boolean {
    return from !== to && crossRate(from, to, rates) !== undefined;
  }

  rate(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): Big {
    return requireRate(crossRate(from, to, rates), from, to);
  }
}
