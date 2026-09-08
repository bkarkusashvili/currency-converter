// How a conversion was priced, reported to the client so a rate can be read
// back: `cross` means two rates and two spreads were composed, `direct` one.
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
