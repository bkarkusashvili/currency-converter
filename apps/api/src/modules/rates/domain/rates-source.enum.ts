// Where the snapshot a response was built from came from. Reported to the
// client so a stale answer is visibly stale rather than silently old.
//
// A string enum rather than a union of literals: the response DTOs, the stored
// record and its Mongoose schema all enumerate the set, and each of them reads
// it from here rather than repeating the values.
export enum RatesSource {
  Cache = 'cache',
  Provider = 'provider',
  StaleCache = 'stale-cache',
  // The last resort: the newest daily snapshot the Mongo archive holds, served
  // when the upstream is down and neither cache key survived. Older than
  // `stale-cache` by construction — the fallback key outlives the fresh one by
  // a day, and the archive outlives both by RATES_ARCHIVE_TTL_DAYS.
  Archive = 'archive',
}
