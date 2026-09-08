import type Big from 'big.js';
import { Money } from './money';

// Half away from zero, the rounding a price list and an invoice both use.
//
// The mode is passed rather than left to the constructor's `RM`: a default is
// shared by everything that reads it and money must not round differently
// because something else set it. Taking a Big rather than a number is the
// other half of that: a caller composes the whole calculation in big.js and
// this is where it becomes a JSON number, so no intermediate is ever a float.
export function roundHalfUp(value: Big, decimals: number): number {
  return value.round(decimals, Money.roundHalfUp).toNumber();
}
