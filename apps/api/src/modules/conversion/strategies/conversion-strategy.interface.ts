import type Big from 'big.js';
import { CurrencyCode } from '../../../common/currency/currency-code.types';
import { ExchangeRate } from '../../rates/domain/exchange-rate.types';
import { ConversionStrategyName } from '../../../common/conversion/conversion-strategy-name.enum';

// One way of pricing a pair: the `to`-per-`from` rate for the pairs it can
// price from the snapshot it is handed, and `undefined` for the ones it cannot.
// The rate is unrounded — rounding belongs to the edge that publishes the
// number, not to a step another rate may still be multiplied by.
//
// One method rather than `supports` and `rate`: the pair was priced or it was
// not, and a strategy that answered the question twice threw the first answer
// away — up to two 30-digit divisions and a full scan of the snapshot per
// conversion. It also makes "supports is the precondition of rate" a thing that
// cannot be got wrong rather than a thing the comment asked for.
export interface ConversionStrategy {
  readonly name: ConversionStrategyName;

  price(
    from: CurrencyCode,
    to: CurrencyCode,
    rates: readonly ExchangeRate[],
  ): Big | undefined;
}

// The token the resolver injects the registered strategies as an ordered array
// of; the order is the §5 precedence and the module declares it.
export const CONVERSION_STRATEGIES = Symbol('CONVERSION_STRATEGIES');
