// Where the snapshot a response was built from came from. Reported to the
// client so a stale answer is visibly stale rather than silently old.
export type RatesSource = 'cache' | 'provider' | 'stale-cache';
