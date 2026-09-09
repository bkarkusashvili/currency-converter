// The window /rates/history serves, and the bound both ends of the request
// agree on: the DTO validates a query against it and the adapter clamps to it.
// It lives here rather than in the DTO because the archive port takes a `days`
// from whoever calls it, and an unbounded one is a scan of the whole
// collection in a route that answers a chart.
//
// The ceiling is the widest window this API answers, and it is the number the
// archive's retention is held against rather than the other way round:
// RATES_ARCHIVE_TTL_DAYS defaults to the same 90 and the schema factory refuses
// to build a shorter one, so every day a request may ask for is a day the
// collection still holds. A window past the ceiling is refused by the API, not
// by expiry.
export const DEFAULT_RATE_HISTORY_DAYS = 7;
export const MAX_RATE_HISTORY_DAYS = 90;
