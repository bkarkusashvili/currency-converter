import type Big from 'big.js';
import { RateNotAvailableError } from '../../../common/errors/rate-not-available.error';
import { CurrencyCode } from '../../rates/domain/currency-code';

// `supports` is the precondition of `rate`, and the resolver is what enforces
// it. This is how a strategy states that without a non-null assertion: called
// out of contract it answers the same 422 the resolver would have, rather than
// a TypeError from somewhere further in.
export function requireRate(
  rate: Big | undefined,
  from: CurrencyCode,
  to: CurrencyCode,
): Big {
  if (rate === undefined) {
    throw new RateNotAvailableError(from, to);
  }

  return rate;
}
