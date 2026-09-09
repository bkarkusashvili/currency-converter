import Big from 'big.js';

// The Big constructor the money path builds every value with. `Big()` returns
// an additional constructor whose `DP` and `RM` are its own, so what a division
// here answers cannot be changed by anything else in the process assigning to
// the global `Big.DP` — the same mutable default `roundHalfUp` refuses to read
// for its rounding mode. With `Big.DP = 2` set anywhere, `new Big(1).div(44.831)`
// is `0.02`; `new Money(1).div(44.831)` is still the rate.
//
// Thirty places is far more than the six a rate is published to, so the two
// legs of a cross rate compose without the intermediate moving the answer, and
// half-up is the rule §5 states for the money that comes out of it.
export const Money = Big();

Money.DP = 30;
Money.RM = Big.roundHalfUp;
