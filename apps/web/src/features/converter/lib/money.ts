import Big from 'big.js';

/**
 * The constructor the offline estimate builds every value with, mirroring
 * `common/money` on the API. `Big()` returns a constructor whose `DP` and `RM`
 * are its own, so a division here cannot be changed by anything else in the
 * bundle assigning to the global `Big.DP`: with `Big.DP = 2` set anywhere,
 * `new Big(1).div(44.831)` is `0.02`. Thirty places is the same room the API
 * gives itself, which is what keeps two implementations of §5 from parting on
 * an intermediate neither of them publishes.
 */
export const Money = Big();

Money.DP = 30;
Money.RM = Big.roundHalfUp;

/** §3: the effective rate is published to six decimals, the money to two. */
export const RATE_DECIMALS = 6;
export const RESULT_DECIMALS = 2;

/** Half away from zero, the rounding a price list uses; the mode is passed rather than left to a default. */
export function roundHalfUp(value: Big, decimals: number): number {
  return value.round(decimals, Money.roundHalfUp).toNumber();
}

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

  return roundHalfUp(new Money(1).div(rate), RATE_DECIMALS);
}
