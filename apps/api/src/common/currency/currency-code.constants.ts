// The whole rule for a currency code on the wire, and the only one: a length
// check beside it would report one mistake twice in `details.errors[].messages`,
// since a code of the wrong length is already a code that does not match.
//
// Shared vocabulary rather than one module's (§9): /convert validates a body
// against it and /rates/history validates a query string against it, and two
// copies of a pattern are two things that can drift into disagreeing about what
// a currency code is.
export const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/;

// For OpenAPI, which cannot read a pattern's quantifier.
export const CURRENCY_CODE_LENGTH = 3;
