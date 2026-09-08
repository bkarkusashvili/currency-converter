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
