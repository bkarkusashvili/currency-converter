import type Big from 'big.js';
import { Money } from '../../../common/money/money';
import { CurrencyCode } from '../../../common/currency/currency-code';
import { ExchangeRate } from '../../rates/domain/exchange-rate';
import { findRate } from './find-rate';

// A rate the snapshot cannot be trusted to price with. The upstream payload is
// validated positive at its boundary, but a cached snapshot outlives a deploy
// and is only checked for shape, and a zero would otherwise divide.
function usable(rate: number | undefined): number | undefined {
  return rate !== undefined && rate > 0 ? rate : undefined;
}

function forwardRate(pair: ExchangeRate | undefined): number | undefined {
  return usable(pair?.buy) ?? usable(pair?.cross);
}

function reverseRate(pair: ExchangeRate | undefined): number | undefined {
  return usable(pair?.sell) ?? usable(pair?.cross);
}

// The §5 table, in one place: Monobank quotes one unit of `base` in `quote`, so
// going base → quote pays what the bank buys `base` at and going quote → base
// pays what it sells `base` at, with the mid rate standing in for both on the
// pairs published without a spread. Both the direct and the cross strategy are
// this rule — the cross one twice — so it lives here rather than in either.
//
// The pair quoted in the asked-for orientation wins when the snapshot somehow
// holds both, which Monobank's never does; picking one is what makes the answer
// independent of the order the upstream listed its pairs in.
//
// The reciprocal is the one division on the money path, so it is built with
// `Money` rather than the global constructor: thirty decimal places, out of
// reach of whatever `Big.DP` happens to be, and far more than the six a rate is
// published to, so composing two of them cannot move the answer.
export function directionalRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: readonly ExchangeRate[],
): Big | undefined {
  const forward = forwardRate(findRate(rates, from, to));

  if (forward !== undefined) {
    return new Money(forward);
  }

  const reverse = reverseRate(findRate(rates, to, from));

  return reverse === undefined ? undefined : new Money(1).div(reverse);
}
