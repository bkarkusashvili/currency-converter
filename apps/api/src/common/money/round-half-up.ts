import Big from 'big.js';

// Half away from zero, the rounding a price list and an invoice both use.
//
// The mode is passed rather than left to the global Big.RM: that default is
// shared process-wide and mutable, and money must not round differently
// because something else set it. Taking a Big rather than a number is the
// other half of that: a caller composes the whole calculation in big.js and
// this is where it becomes a JSON number, so no intermediate is ever a float.
export function roundHalfUp(value: Big, decimals: number): number {
  return value.round(decimals, Big.roundHalfUp).toNumber();
}
