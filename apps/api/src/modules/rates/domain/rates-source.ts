// Where the snapshot a response was built from came from. Reported to the
// client so a stale answer is visibly stale rather than silently old.
//
// The list is the value, and the type is read off it: the response DTO has to
// enumerate the sources for OpenAPI, and a second copy of the literals is one
// that can disagree with this one.
export const RATES_SOURCES = ['cache', 'provider', 'stale-cache'] as const;

export type RatesSource = (typeof RATES_SOURCES)[number];
