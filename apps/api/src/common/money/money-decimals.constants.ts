// How many decimals a conversion reports, from §3 of the architecture: the
// effective rate to six places, the money to two. They live together because
// they are one decision — how much of the arithmetic's precision is published
// — and apart from the arithmetic itself, which keeps full precision until a
// value leaves the service.
export const RATE_DECIMALS = 6;

export const RESULT_DECIMALS = 2;
