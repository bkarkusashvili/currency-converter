// The page size /history serves, and the one bound both ends of the request
// agree on: the DTO validates a query against it and the adapter clamps to it.
// It lives here rather than in the DTO because the repository port takes a
// `limit` from whoever calls it, and an unbounded one is a full collection scan
// in a route that answers a page.
export const DEFAULT_HISTORY_LIMIT = 10;
export const MAX_HISTORY_LIMIT = 50;
