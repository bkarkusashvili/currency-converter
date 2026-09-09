// The window /rates/history serves, and the bound both ends of the request
// agree on: the DTO validates a query against it and the adapter clamps to it.
// It lives here rather than in the DTO because the archive port takes a `days`
// from whoever calls it, and an unbounded one is a scan of the whole
// collection in a route that answers a chart.
//
// The ceiling is the archive's own retention default (RATES_ARCHIVE_TTL_DAYS):
// asking for more days than are ever kept is a request that cannot be answered
// rather than one that answers short.
export const DEFAULT_RATE_HISTORY_DAYS = 7;
export const MAX_RATE_HISTORY_DAYS = 90;
