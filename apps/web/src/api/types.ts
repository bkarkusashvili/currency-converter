export type ConversionStrategy = 'identity' | 'direct' | 'cross';

export type RateSource = 'cache' | 'provider' | 'stale-cache' | 'archive';

/**
 * The list is the value and the type is read off it, as the API does: the suite
 * has to iterate the codes to check every one has a sentence, and a second copy
 * of the literals is one that can disagree with this one.
 */
export const WARNING_CODES = [
  'CACHE_UNAVAILABLE',
  'HISTORY_NOT_RECORDED',
  'ARCHIVE_NOT_RECORDED',
] as const;

export type ResponseWarningCode = (typeof WARNING_CODES)[number];

/**
 * §3: something that degraded while a successful request was answered. The
 * request has an answer — that is what separates a warning from the error
 * envelope — and this says what it cost. `message` is a sentence safe to show;
 * a client switches on `code`.
 *
 * The field is **absent, not empty**, when nothing degraded, so a healthy
 * response is byte for byte the one it has always been.
 */
export interface ResponseWarning {
  code: ResponseWarningCode;
  message: string;
}

export interface ConvertRequest {
  from: string;
  to: string;
  amount: number;
}

export interface ConvertResponse {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  strategy: ConversionStrategy;
  source: RateSource;
  ratesTimestamp: string;
  warnings?: ResponseWarning[];
}

export interface Currency {
  code: string;
  numericCode: number;
  name: string;
}

export interface CurrenciesResponse {
  currencies: Currency[];
  warnings?: ResponseWarning[];
}

/**
 * §3: an entry carries the provenance the conversion was answered with as well
 * as its numbers. `source` and `ratesTimestamp` are what explain a stored rate
 * that does not match the ones published around it.
 */
export interface HistoryItem {
  id: string;
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  strategy: ConversionStrategy;
  source: RateSource;
  ratesTimestamp: string;
  createdAt: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
}

/**
 * Terminus answers `up` or `down` today. The field stays `string` because the
 * report is a runtime document, not a compiled contract: a value this client has
 * not seen has to render as it arrived rather than be typed out of existence,
 * and the guard that produces this type can only check what it can check.
 */
export interface HealthIndicator {
  status: string;
  [key: string]: unknown;
}

/** `status` is `ok`, `error` or `shutting_down` today; see HealthIndicator for why it is not a union. */
export interface HealthResponse {
  status: string;
  info?: Record<string, HealthIndicator>;
  error?: Record<string, HealthIndicator>;
  details: Record<string, HealthIndicator>;
}

/**
 * One published pair, as `GET /rates` returns it: Monobank quotes one unit of
 * `base` in `quote`, with a spread on the major pairs and a mid rate on the
 * thinner ones (docs/architecture.md §4).
 */
export interface ExchangeRate {
  base: string;
  quote: string;
  buy?: number;
  sell?: number;
  cross?: number;
  date: string;
}

export interface RatesSnapshotResponse {
  source: RateSource;
  fetchedAt: string;
  rates: ExchangeRate[];
  warnings?: ResponseWarning[];
}

/**
 * One archived UTC day of a published pair, as `GET /rates/history` returns it.
 * `date` is the day itself (`YYYY-MM-DD`), not an instant: the archive keeps
 * the last snapshot of each day, so the point is that day at its close. A day
 * the archive has no snapshot for is **absent rather than null**, which is why
 * a series can be shorter than the window it was asked for and why a gap in it
 * is a gap rather than a zero.
 */
export interface RateHistoryPoint {
  date: string;
  buy?: number;
  sell?: number;
  cross?: number;
}

/**
 * The window that was read, echoed with what it held. `days` comes back so a
 * client that relied on the default knows what it got, and `base`/`quote` are
 * the pair as the upstream publishes it — this route inverts and crosses
 * nothing (docs/architecture.md §3).
 */
export interface RateHistoryResponse {
  base: string;
  quote: string;
  days: number;
  points: RateHistoryPoint[];
}
