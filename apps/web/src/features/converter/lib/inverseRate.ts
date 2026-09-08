import { Money } from './money';

/** The same six places §3 publishes the forward rate to. */
const RATE_DECIMALS = 6;

/**
 * `1 to = n from`, the other half of the sentence the result card leads with.
 * The API publishes one direction only, so the other is computed here on the
 * same `big.js` constructor and rounded the same way — half-up to six places —
 * rather than with floating point, which would show a rate the API would never
 * print. A rate that cannot be inverted has no inverse to show.
 */
export function inverseRate(rate: number): number | null {
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return new Money(1).div(rate).round(RATE_DECIMALS, Money.roundHalfUp).toNumber();
}
