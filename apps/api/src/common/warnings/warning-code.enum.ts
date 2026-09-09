// The codes §3 publishes on a successful response to say what degraded while
// it was produced. The value is the wire form; the member is what the code
// names it.
export enum WarningCode {
  CacheUnavailable = 'CACHE_UNAVAILABLE',
  HistoryNotRecorded = 'HISTORY_NOT_RECORDED',
}
