// The fresh key expires into a miss, which is what triggers a refresh; the
// fallback key outlives it by a day so an upstream outage still has an answer.
export const RATES_CACHE_KEYS = {
  fresh: 'rates:latest',
  stale: 'rates:fallback',
} as const;
