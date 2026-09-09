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
}
