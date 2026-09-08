// How a conversion was priced, reported to the client so a rate can be read
// back: `cross` means two rates and two spreads were composed, `direct` one.
//
// Shared vocabulary rather than the conversion module's own: a stored record
// mirrors the conversion it came from, so the history schema, its DTO and the
// domain record all name a strategy too. Keeping it here is what lets the
// history module describe a record without importing from `conversion` (§9).
//
// The list is the value and the type is read off it, the way RATES_SOURCES is:
// the response DTO has to enumerate the names for OpenAPI, and a second copy of
// the literals is one that can disagree with this one.
export const CONVERSION_STRATEGY_NAMES = [
  'identity',
  'direct',
  'cross',
] as const;

export type ConversionStrategyName = (typeof CONVERSION_STRATEGY_NAMES)[number];
