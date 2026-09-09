# Architecture

This document is the design contract for the project. Every module, endpoint and
behaviour described here is implemented; deviations must be reflected here.

## 1. Overview

```
Browser ──▶ web (React SPA, nginx) ──▶ api (NestJS) ──▶ Redis     (rates cache)
                                              ├──────▶ MongoDB   (conversion history)
                                              └──────▶ Monobank  (upstream rates)
```

Monorepo layout:

| Path                     | What                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `apps/api`               | NestJS 11, TypeScript strict, REST API                                                 |
| `apps/web`               | React 19 + Vite + TypeScript SPA                                                        |
| `docker-compose.yml`     | api, web, redis, mongo for local orchestration                                          |
| `docker-compose.dev.yml` | overlay: the backing services alone, published on loopback                              |
| `docs/architecture.md`   | this document; §3 is the written API contract, and the generated one is Swagger `/docs` |
| `README.md`              | how to run it, the configuration surface, the API reference, requirements traceability  |
| `.github/workflows`      | CI: per app lint, format, typecheck, build, unit tests with coverage, audit and image build (plus e2e for the api); one more job that boots the Compose stack and probes it |

Each app is an independent npm package with its own lockfile so it can be built
and deployed in isolation (Docker, Railway).

## 2. Design principles

- **Ports and adapters.** Domain code depends on interfaces (`RatesProvider`,
  `RatesRepository`, `HistoryRepository`); infrastructure (Monobank, Redis,
  Mongo) implements them and is bound through NestJS DI tokens. Swapping the
  rate source or the cache is a one-line module change.
- **Strategy pattern** for conversion (identity, direct pair, cross via UAH),
  chosen by a resolver at runtime.
- **Cache-aside** with a fresh key and a long-lived fallback key, explicit
  invalidation, and single-flight de-duplication of concurrent misses.
- **Resilience** around the upstream: timeout, retry with exponential backoff
  and jitter, circuit breaker (CLOSED → OPEN → HALF_OPEN).
- **Graceful degradation, said out loud.** Redis or Mongo being down never
  breaks a conversion; it is logged, surfaced on `/health`, and the request
  still succeeds when the upstream (or a stale copy) is reachable — and the
  answer carries a `warnings` entry saying what it cost, so the degradation is
  visible to the client and not only to whoever reads the logs.
- **One error envelope** for every failure, produced by a global exception
  filter from a small hierarchy of typed domain errors.
- **Strict typing, small files, no comments that restate the code.** Comments
  are reserved for non-obvious *why*s.

## 3. API contract

Base path: `/api/v1`. All responses are JSON. Swagger UI at `/docs`,
OpenAPI JSON at `/docs-json` — 7 operations, 10 schemas and one `admin` security
scheme, generated from the controllers and kept honest by
`test/e2e/swagger.e2e-spec.ts`.

The response bodies below are real, captured from the deployment on
2026-09-08 (the degraded ones from a local stack with the container in question
stopped, because production was healthy). Rates move, so the numbers date; the
shapes do not.

### POST `/api/v1/convert`

Request body:

```json
{ "from": "EUR", "to": "GBP", "amount": 100 }
```

| Field    | Rules                                                          |
| -------- | -------------------------------------------------------------- |
| `from`   | ISO 4217 alpha-3, case-insensitive, normalised to upper case   |
| `to`     | same as `from`                                                 |
| `amount` | finite number, `> 0`, `<= 1_000_000_000_000`                   |

Response `200`:

```json
{
  "from": "EUR",
  "to": "GBP",
  "amount": 100,
  "result": 84.75,
  "rate": 0.847472,
  "strategy": "cross",
  "source": "cache",
  "ratesTimestamp": "2026-09-08T18:02:02.902Z"
}
```

- `rate` is the effective `to`-per-`from` rate, rounded half-up to 6 decimals.
- `result` is `amount` times the **unrounded** effective rate, rounded half-up
  to 2 decimals — not `amount × rate` as published, so on a large amount the two
  differ in the last cent. §5 has the rule and the arithmetic behind it.
  Arithmetic uses `big.js`; floating point is never used for money.
- `strategy`: `identity` | `direct` | `cross`.
- `source`: `cache` | `provider` | `stale-cache`.
- `warnings` is absent unless something degraded while the conversion was
  answered — see **Warnings** below.

### GET `/api/v1/rates`

Returns the current snapshot the service would convert with:

```json
{
  "source": "cache",
  "fetchedAt": "2026-09-08T18:02:02.902Z",
  "rates": [
    { "base": "USD", "quote": "UAH", "buy": 44.35, "sell": 44.831, "date": "2026-09-08T11:51:13.000Z" },
    { "base": "EUR", "quote": "USD", "buy": 1.158, "sell": 1.168, "date": "2026-09-08T15:06:13.000Z" },
    { "base": "GBP", "quote": "UAH", "cross": 60.7336, "date": "2026-09-08T18:01:49.000Z" }
  ]
}
```

A pair carries `buy` and `sell` when Monobank publishes a spread for it and
`cross` when it publishes a mid rate instead; §5 is the rule for which of the
three a direction multiplies by.

`warnings` appears here on the same terms as on `/convert`.

### DELETE `/api/v1/rates/cache`

Invalidates both cache keys. Returns `204`, whether or not the keys were there:
the request states the wanted end state. If `ADMIN_API_KEY` is configured the
request must carry it in the `x-api-key` header (`401` otherwise).

A cache that could not be reached answers `503 CACHE_UNAVAILABLE` rather than
`204`. This is the one place a Redis failure is not degraded away: the request
is not a read on the way to an answer but a state change the caller commanded,
and the only reason to command it is to force the next read to refetch —
reporting success for keys that are still there tells an operator the cache is
empty while the stale rates they were clearing keep being served.

### GET `/api/v1/currencies`

Currencies present in the current snapshot plus `UAH`, sorted by code:

```json
{ "currencies": [{ "code": "EUR", "numericCode": 978, "name": "Euro" }] }
```

`warnings` appears here on the same terms as on `/rates`. The list is a
projection of the same snapshot, read through the same service, so a cache that
could not be reached costs this route exactly what it costs that one — and this
is the route a client calls first, to fill a picker.

### GET `/api/v1/history?limit=10`

Most recent conversions, newest first. `limit` is `1..50`, default `10`, and it
is validated rather than clamped: `?limit=0`, `?limit=51` and `?limit=abc` each
answer `400` naming the field. The `50` is `MAX_HISTORY_LIMIT`, shared by the
DTO that validates the query and the adapter, which clamps to it as well —
nothing that reaches the repository port can ask it for the whole collection.

```json
{
  "items": [
    {
      "id": "6aa04e94e54de00da51c08ce",
      "from": "EUR",
      "to": "GBP",
      "amount": 100,
      "result": 84.75,
      "rate": 0.847472,
      "strategy": "cross",
      "source": "cache",
      "ratesTimestamp": "2026-09-08T18:02:02.902Z",
      "createdAt": "2026-09-08T18:06:12.588Z"
    }
  ]
}
```

An entry carries the provenance a conversion was answered with as well as its
numbers. `source` and `ratesTimestamp` are what explain a stored rate that does
not match the ones published around it; without them a result priced from the
stale fallback cannot be reconciled after the fact.

While MongoDB is unreachable this route answers `503 HISTORY_UNAVAILABLE` with a
`details.reason`, never an empty page — "nothing recorded yet" and "the store is
down" are different answers — and never a driver message, which carries the
connection string with the credentials in it. Conversions keep being served
meanwhile: the record is skipped, the response is not (§2).

### GET `/health`

`@nestjs/terminus` response with indicators `redis`, `mongodb`, `monobank`.

- `redis` — `PING` under a short budget of its own. `up`, or `down` with the
  reason `ping failed` or `timeout`.
- `mongodb` — the connection state, then a `ping` under the same kind of budget.
  `up`, or `down` with the reason `not connected`, `ping failed` or `timeout`.
  The state is checked first: a command issued while nothing is connected
  reports the driver's complaint rather than the fact that there is nothing to
  command.
- `monobank` — the circuit-breaker state; it does **not** call the upstream,
  which allows one request per minute and would be starved by a probe running
  every few seconds. `CLOSED` is `up`, `HALF_OPEN` is `up` with the reason
  `circuit half-open` (the next call is allowed through and the stale cache is
  answering meanwhile), `OPEN` is `down` with the reason `circuit open`.

Indicators are injected through the `HEALTH_INDICATORS` token as
`HealthIndicatorPort`s, so adding one does not touch the controller. This route
is the one exception to the error envelope below: a failing indicator answers
`503` with the Terminus report itself, because collapsing it into the envelope
would hide which dependency is down.

Because that report is public, an indicator reports only a `status` and, when it
is down, a short sanitised `reason` it chose itself. A driver error is never
passed through: a Mongo or Redis connection failure carries the connection
string, credentials included, in its message.

### GET `/health/live`

The same Terminus shape with no indicators at all, so it answers `200` whenever
the process is up and able to serve a request:

```json
{ "status": "ok", "info": {}, "error": {}, "details": {} }
```

The two routes exist because they answer different questions, and one answer
must not be used for the other's job:

- `/health` is the **dependency report**, and it is what monitoring reads: `503`
  the moment any indicator is down, with the report saying which.
- `/health/live` is the **liveness probe**, and it is what deploy gates and
  container health checks use: Railway's `healthcheckPath`, the Dockerfile's
  `HEALTHCHECK` and the Compose `api` healthcheck all point here.

Pointing a deploy gate at `/health` makes every dependency a hard one. Redis
being down degrades the rates cache to an upstream call and Mongo being down
degrades one route out of five (§2) — neither stops the API converting, and
neither is a reason to fail a rollout or restart the container. Sending the
probes here and monitoring there is what keeps `/health` free to report `503`
honestly.

`/health/live` is exempt from the throttler (`@SkipThrottle()`): a probe runs
far more often than a client, and sharing a bucket with one would let the rate
limit restart a healthy process. `/health` is not exempt but generous — 60
requests a minute per client, well above any monitoring poll rate — because it
issues a Redis `PING` and a Mongo ping per request, and an unauthenticated
route with no limit at all is an amplifier pointed at both. Both routes are
excluded from the versioned prefix, and a successful probe of either is dropped
from the request log (§7); a failing one is not.

### Warnings

`POST /api/v1/convert`, `GET /api/v1/rates` and `GET /api/v1/currencies` can
carry a `warnings` array beside their answer:

```json
{
  "warnings": [
    {
      "code": "CACHE_UNAVAILABLE",
      "message": "The rates cache could not be reached during this request, so it was not used; `source` says where the rates came from."
    }
  ]
}
```

The request succeeded — that is what separates a warning from the error
envelope below — and each entry says what degraded while it was being answered.
All three assemble the array the same way and in the same place: the service
reports what degraded (`RatesLookup.cacheDegraded`, `ConversionOutcome`) and the
controller turns that into the field, so a stored conversion is a record of what
was converted rather than of the request that converted it.
The field is **absent, not empty**, when nothing did: it exists to be noticed,
and a healthy response is byte for byte the one it has always been.

| `code`                 | When                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CACHE_UNAVAILABLE`    | Any of the three: Redis could not be read from or written to while the request was answered, so the cache neither served this response nor kept it for the next one |
| `HISTORY_NOT_RECORDED` | `/convert` only: the conversion was answered but its record was dropped or timed out, so it will not appear in `/history`                                      |

`message` is a sentence safe to show to a user; a client switches on `code`.
`CACHE_UNAVAILABLE` says nothing about where the rates came from, because the
flag behind it is raised by a failed read, a failed write, or both: a read that
timed out and a write that then succeeded is one of them, a degraded read
answered from the stale key is another, and neither is "fetched from the
upstream and not cached". `source` is the field that answers that, and it is on
the same response.
`CACHE_UNAVAILABLE` is deliberately also an error `code` in the table below: it
is the same condition, reported beside a successful answer when the request
could still be served and in the envelope when it could not — which on
`DELETE /rates/cache` it cannot.
Both are the counterpart of the degradation model in §2: Redis being down and
Mongo being down each cost something the client could not previously see, and a
warning is where the answer says so. A cache that answered with an unreadable
value is not `CACHE_UNAVAILABLE` — it was reached, the value is discarded and
the request pays an upstream call, which is exactly what an expiry costs.

### Error envelope

Every non-2xx response has this shape:

```json
{
  "statusCode": 422,
  "code": "UNSUPPORTED_CURRENCY",
  "message": "Currency 'XYZ' is not supported",
  "details": { "currency": "XYZ" },
  "timestamp": "2026-09-08T12:00:00.000Z",
  "path": "/api/v1/convert",
  "requestId": "…"
}
```

| HTTP | `code`                 | When                                                 |
| ---- | ---------------------- | ---------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | DTO validation failed; `details.errors` lists fields |
| 401  | `UNAUTHORIZED`         | Missing/invalid admin API key                        |
| 403  | `FORBIDDEN`            | The caller may not perform this operation            |
| 404  | `NOT_FOUND`            | Unknown route                                        |
| 422  | `UNSUPPORTED_CURRENCY` | Code is not in the snapshot                          |
| 422  | `RATE_NOT_AVAILABLE`   | No path between the two currencies                   |
| 429  | `TOO_MANY_REQUESTS`    | Throttler limit exceeded                             |
| 503  | `RATES_UNAVAILABLE`    | Upstream failed and no stale copy exists             |
| 503  | `CACHE_UNAVAILABLE`    | The cache could not be reached to invalidate it      |
| 503  | `HISTORY_UNAVAILABLE`  | The conversion history store cannot be read          |
| 500  | `INTERNAL_ERROR`       | Anything unexpected; message is generic              |

`details.errors` carries one entry per field that failed and exactly one message
per entry. The DTOs declare each field's type check last and the pipe stops at
the first failure a field records, so `amount: "100"` is reported as the number
it is not rather than as every bound `NaN` is also outside — a multi-field body
still reports every field.

Any other 4xx keeps its status and takes its `code` from the name the exception
reports, upper-snake-cased, falling back to the status's own name: a 406 answers
`NOT_ACCEPTABLE` and a 409 `CONFLICT`. A 4xx never answers `INTERNAL_ERROR`,
which would contradict its status. Every 5xx does: the status is kept, the code
is `INTERNAL_ERROR` and the message is generic, so nothing internal leaks.

## 4. Rates domain

```ts
type CurrencyCode = string; // ISO 4217 alpha-3, upper case

interface ExchangeRate {
  base: CurrencyCode;   // currencyCodeA
  quote: CurrencyCode;  // currencyCodeB
  buy?: number;         // rateBuy  – bank buys `base`, pays `quote`
  sell?: number;        // rateSell – bank sells `base`, receives `quote`
  cross?: number;       // rateCross – mid rate when buy/sell are absent
  date: string;         // ISO timestamp from Monobank `date`
}

interface RatesSnapshot {
  fetchedAt: string;    // ISO timestamp of the upstream fetch
  rates: ExchangeRate[];
}
```

Monobank returns numeric ISO codes; they are mapped to alpha-3 with the
`currency-codes` package. Entries whose numeric code is unknown are dropped
(logged at debug level). Entries with no usable rate are dropped.

Both ways into a snapshot are validated with `zod` before anything reads them:
the upstream payload in `MonobankRatesProvider`, so a malformed response fails
at the boundary instead of poisoning the cache, and a cached value in
`RedisRatesRepository`, because the key outlives a deploy and is shared by every
instance — "this process wrote it" is not a reason to trust its shape. Unknown
fields are ignored rather than rejected, so a field Monobank adds cannot take
the API down. A cached value that does not parse is discarded and read as a
miss.

### Ports

```ts
const RATES_PROVIDER = Symbol('RATES_PROVIDER');
interface RatesProvider { fetchRates(): Promise<RatesSnapshot>; }

const RATES_REPOSITORY = Symbol('RATES_REPOSITORY');

// domain/ports.ts — what a cache operation did, and whether the cache
// was there to do it. A read that answers `null` alone cannot tell a miss from
// an outage, and the two are different answers on the response.
interface CachedSnapshot { snapshot: RatesSnapshot | null; degraded: boolean; }
interface CacheWrite { degraded: boolean; }

interface RatesRepository {
  getFresh(): Promise<CachedSnapshot>;    // degrades: { snapshot: null, degraded: true }
  getStale(): Promise<CachedSnapshot>;    // degrades: { snapshot: null, degraded: true }
  save(snapshot: RatesSnapshot): Promise<CacheWrite>;  // degrades: { degraded: true }
  clear(): Promise<void>;                 // rejects: CacheUnavailableError when
                                          // the cache could not be reached
}
```

### `RatesService.getSnapshot()` (cache-aside)

```
fresh = repo.getFresh()            → hit: return { snapshot, source: 'cache' }
miss → single-flight:
  try   snapshot = provider.fetchRates()   (retry + circuit breaker inside)
        repo.save(snapshot)                (errors logged, not thrown)
        return { snapshot, source: 'provider' }
  catch stale = repo.getStale()
        stale ? { snapshot: stale, source: 'stale-cache' } : throw RatesUnavailableError

every branch also carries cacheDegraded: whether any of those cache calls failed
```

- Concurrent callers during a miss share one in-flight promise, cleared in a
  `finally` so a failed refresh does not strand the caller behind it.
- `RatesUnavailableError` carries a `details.reason` that names the resilience
  decision — `upstream circuit open` or `upstream request failed` — and never
  the upstream's own message, which travels to the client in the envelope and
  carries the url, the status text and sometimes the body.
- The request-path methods catch Redis errors, log a warning with the operation
  name, and degrade (no snapshot on reads, no-op on writes) — and report that
  they did, because `null` alone cannot tell an expiry from an outage. That flag
  travels on `RatesLookup.cacheDegraded` and becomes §3's `CACHE_UNAVAILABLE`
  warning on the response.

### Redis keys

| Key               | TTL env                    | Default |
| ----------------- | -------------------------- | ------- |
| `rates:latest`    | `RATES_CACHE_TTL_SECONDS`  | 300     |
| `rates:fallback`  | `RATES_STALE_TTL_SECONDS`  | 86400   |

Both are written on every successful upstream fetch. `DELETE /rates/cache`
removes both, or answers `503 CACHE_UNAVAILABLE` if it could not (§3). Values
are the JSON-serialised `RatesSnapshot`.

## 5. Conversion semantics

Monobank publishes `1 base = X quote`. `rateBuy` is the price at which the bank
buys `base`; `rateSell` is the price at which it sells `base`; `rateCross` is
a mid rate for pairs without a spread. From the client's point of view:

| Direction            | Multiply amount by                     |
| -------------------- | -------------------------------------- |
| `base → quote`       | `buy ?? cross`                         |
| `quote → base`       | `1 / (sell ?? cross)`                  |

`ConversionStrategyResolver` settles membership before it prices anything: the
snapshot has to quote `from`, then `to`, or the answer is `UNSUPPORTED_CURRENCY`
naming the code. It cannot be left to the chain below failing, because
`IdentityStrategy` prices any code against itself and `XYZ → XYZ` would answer
`200` at rate `1` for a code `/currencies` never lists. Checking first also
keeps every strategy ignorant of what the API supports, and leaves one meaning
for a chain that finds nothing: both codes are quoted and there is no path
between them, which is `RATE_NOT_AVAILABLE`.

Strategies, tried in order once both codes are known to be quoted:

1. **`IdentityStrategy`** — `from === to` → rate `1`.
2. **`DirectPairStrategy`** — a rate exists for `(from, to)` or `(to, from)`
   (e.g. `USD/UAH`, `UAH/USD`, `EUR/USD`).
3. **`CrossRateStrategy`** — both `from` and `to` have a pair against the base
   currency `UAH`; rate = `rate(from→UAH) × rate(UAH→to)`.

The direction rule above lives in one function, `directionalRate`, which both
the direct and the cross strategy use — the cross one twice, once per leg — so
"buy going out, sell coming back" has a single definition. When the snapshot
holds the pair in both orientations, which Monobank's never does, the one quoted
in the asked-for direction wins: picking one is what makes the answer
independent of the order the upstream listed its pairs in. A rate that is not
positive is read as absent: the upstream payload is validated positive at its
boundary, but a cached snapshot outlives a deploy and is only checked for
shape, and a zero would otherwise divide. `IdentityStrategy` is first in the
chain rather than an early return because the snapshot does hold a path from a
currency back to itself, out through the base currency and back, losing both
spreads.

### Rounding, and what the two numbers are for

`rate` is rounded half-up to 6 decimals and `result` to 2, and each is rounded
once, at the edge that publishes it. Nothing in between is: a strategy returns
its rate at full precision, and `result` is `amount` times *that* rather than
times the six decimals of it that go out. The two answers part on a large
amount — 1,000,000 GBP → PLN is 4,986,801.71 from the unrounded rate and
4,986,802.00 from the published one, 29 groszy apart — and the reconcilable one
is full precision's. `rate` is a report of what was used, not the input the
result came from.

The same rule at the other end of the scale: an amount worth less than half a
minor unit of `to` rounds to `result: 0`. `0.01 UAH → USD` is 0.000223 dollars,
so it answers `200` with `result` `0` and `rate` `0.022306`. It is not an error
— the pair was priced, and that is what the amount is worth — and `rate` is what
makes the zero readable.

Every value on that path is built with `Money`, the configured `big.js`
constructor in `common/money`, rather than the global `Big`. `Big.DP` and
`Big.RM` are process-wide and writable by anything that imports big.js, and the
reciprocal in `directionalRate` is a division: at `Big.DP = 2` it would answer
`0.02` for the hryvnia. `Money` carries 30 decimal places of its own, far more
than the six a rate is published to, so composing the two legs of a cross rate
cannot move the answer either.

```ts
// common/conversion/conversion-strategy-name.ts — shared vocabulary, because a
// stored record names a strategy too (§9).
type ConversionStrategyName = 'identity' | 'direct' | 'cross';

interface ConversionStrategy {
  readonly name: ConversionStrategyName;
  price(from: CurrencyCode, to: CurrencyCode, rates: readonly ExchangeRate[]): Big | undefined;
}
```

One method, not a `supports` predicate and a `rate` beside it: the pair was
priced or it was not. `ConversionStrategyResolver.resolve` returns
`{ strategy, rate }` — the first strategy of the chain that answered and the
rate it answered with — so nothing prices the pair twice and "the precondition
of `rate` is `supports`" is unrepresentable rather than commented.

## 6. Resilience (`apps/api/src/common/resilience`)

- **`retry(fn, { attempts, baseDelayMs, maxDelayMs, shouldRetry })`** —
  exponential backoff with full jitter. Monobank calls retry only on network
  errors, timeouts and `5xx`. `429` is never retried (the limit is 1 req/min;
  retrying makes it worse) and falls through to the stale cache.
- **`CircuitBreaker`** — states `CLOSED`, `OPEN`, `HALF_OPEN`. Opens after
  `failureThreshold` consecutive failures, rejects immediately with
  `CircuitOpenError` while open, allows a single trial call after
  `resetTimeoutMs`, closes on success / reopens on failure. Exposes `state` for
  the health indicator. Implemented in-house (~80 lines) so it is fully unit
  tested and dependency-free. The instance is bound to the
  `MONOBANK_CIRCUIT_BREAKER` token (declared beside the other rates tokens in
  `rates/domain`) by `MonobankModule`, which `RatesModule` re-exports, so the
  health indicator reports the breaker the provider actually trips rather than
  one of its own that nothing ever opens — and reaches it through the rates
  module's exports instead of importing its infrastructure folder.
- **Timeout** on every upstream request (`MONOBANK_TIMEOUT_MS`), and an overall
  budget on the whole call (`MONOBANK_TOTAL_BUDGET_MS`, 8 s):
  `withTimeout(retry(...), budget)` inside the breaker. The per-request timeout
  bounds one attempt, so the attempts plus the backoff between them add up to
  far longer than any of them, and single-flight makes every concurrent caller
  wait out the same sum — for a stale copy that was already in Redis when the
  first one arrived. The budget sits inside the breaker so an expiry counts as
  an upstream failure rather than passing through unnoticed.
- **A response ceiling** on the upstream client (`maxContentLength` /
  `maxBodyLength`, 2 MB against a ~30 KB payload): the timeout bounds how long
  a response may take and nothing bounded how large it may be.
- **Throttling** via `@nestjs/throttler` on every route but the liveness
  probe, which is exempt, and `/health`, which carries a generous limit of its
  own (§3). The buckets live in the throttler's default in-process storage, so
  the documented `THROTTLE_LIMIT` is per replica and a restart empties them —
  correct for the single instance this deploys as.
- **Single-flight** cache refresh (see §4) so a burst of misses produces one
  upstream call.
- **Shutdown order.** `RedisConnection` and `MongoConnection` tear down in
  `onApplicationShutdown`, not `onModuleDestroy`: Nest closes the HTTP listener
  in `dispose()`, which runs between the two. Declared as destroy hooks they
  took the cache and the history store away from the requests still in flight
  during a rolling deploy, which is the one window where the degradation
  promises above would have been broken by the shutdown itself.

## 7. Errors and logging

```ts
abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly status: HttpStatus;
  constructor(message: string, readonly details?: Record<string, unknown>) {}
}
```

Concrete: `UnsupportedCurrencyError`, `RateNotAvailableError`,
`RatesUnavailableError`, `CacheUnavailableError`, `HistoryUnavailableError`,
`UnauthorizedError`.
`CircuitOpenError` is internal and is translated to `RatesUnavailableError` by
`RatesService`.

`GlobalExceptionFilter` (registered with `APP_FILTER`):

- `AppError` → its status/code, message and details.
- Nest `HttpException` (validation, throttler, 404) → normalised into the
  envelope with the codes from §3.
- Anything else → `500 INTERNAL_ERROR`, generic message, full stack logged.

Something that is down is observed again on every attempt, so the three places
that watch a dependency — the Redis client's reconnect loop, the Mongo
connection's state changes and the history writes being dropped — report
through one `createOutageReporter`: a warning when the outage starts, a debug
line for the repeats or nothing at all, and one line when it ends.

A failure is logged as pino's `err` field rather than interpolated into the
message, which is what serialises the stack into the JSON line; the two
bootstrap paths that log before or during the logger's own flush use the Nest
logger and `errorStack` instead.

Logging uses `nestjs-pino`: JSON in production, `pino-pretty` in development,
one log line per request carrying exactly the request id, method, path, client
address, status and duration. Those fields are produced by custom
`serializers.req` / `serializers.res`, which emit `req.id`, `req.method`,
`req.url` and `req.remoteAddress` and `res.statusCode`; pino-http adds the
duration as `responseTime`. The id is on the line once, inside `req`. No header
is ever written, so a credential cannot reach the log by being forgotten in a
denylist. Services use the injected `PinoLogger` with a context.

The line is levelled by outcome: `error` for a 5xx or a thrown error, `warn` for
a 4xx, `info` otherwise. A successful `/health` probe is dropped entirely — it
runs every few seconds and says nothing — while a failing one still takes the
`error` branch.

The `requestId` is assigned by a middleware registered first in `configureHttp`,
before Nest's body parser, so a request that dies in the parser still gets an
envelope, an `x-request-id` header and a log line. An inbound `x-request-id` is
honoured when it is at most 128 characters of `[A-Za-z0-9._-]`, and replaced by
a generated UUID otherwise.

## 8. Configuration

`@nestjs/config` with a `zod` schema; the process fails fast on invalid env.
`ConfigService<AppConfig, true>` is used everywhere for typed, non-nullable
reads.

| Variable                            | Default                                   |
| ----------------------------------- | ----------------------------------------- |
| `NODE_ENV`                          | `development`                             |
| `PORT`                              | `3000`                                    |
| `LOG_LEVEL`                         | `info`                                    |
| `CORS_ORIGINS`                      | `http://localhost:5173,http://localhost:8080` |
| `TRUST_PROXY`                       | `false`                                   |
| `REDIS_URL`                         | `redis://localhost:6379`                  |
| `REDIS_COMMAND_TIMEOUT_MS`          | `300`                                     |
| `MONGO_URL`                         | `mongodb://localhost:27017/currency_converter` |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | `3000`                                    |
| `HISTORY_OPERATION_TIMEOUT_MS`      | `1000`                                    |
| `HISTORY_TTL_DAYS`                  | `30`                                      |
| `MONOBANK_API_URL`                  | `https://api.monobank.ua/bank/currency`   |
| `MONOBANK_TIMEOUT_MS`               | `5000`                                    |
| `MONOBANK_RETRY_ATTEMPTS`           | `3`                                       |
| `MONOBANK_RETRY_BASE_DELAY_MS`      | `300`                                     |
| `MONOBANK_TOTAL_BUDGET_MS`          | `8000`                                    |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5`                                       |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS`  | `30000`                                   |
| `RATES_CACHE_TTL_SECONDS`           | `300`                                     |
| `RATES_STALE_TTL_SECONDS`           | `86400`                                   |
| `THROTTLE_TTL_SECONDS`              | `60`                                      |
| `THROTTLE_LIMIT`                    | `60`                                      |
| `ADMIN_API_KEY`                     | *(unset → cache invalidation is open; required in production)* |

`ADMIN_API_KEY` is optional in development and test, where an unset key makes
`ApiKeyGuard` a no-op so a local run needs no secret, and required when
`NODE_ENV=production`: the schema's `superRefine` fails startup without one.
`DELETE /rates/cache` clears the snapshot every instance reads, so leaving it
open on a deployment hands anyone who can reach it a lever on an upstream that
allows one request a minute — alternating `DELETE` and `GET` spends exactly the
budget the cache exists to protect. Swagger also advertises the route as
secured, which is only true once the key is set.

`REDIS_COMMAND_TIMEOUT_MS` is the deadline on a single Redis command.
`maxRetriesPerRequest` bounds the reconnects that follow a socket error and
`enableOfflineQueue: false` refuses a command issued while the socket is down,
but neither ends a command already written to a socket that stops answering.
The cache is on the request path, so without a deadline `GET /rates` waits on it
indefinitely; with one, the command rejects and `RedisRatesRepository` degrades
it to a miss and an upstream call.

`TRUST_PROXY` feeds Express's `trust proxy`: `false` trusts nobody, `true` trusts
every hop, and a number is how many proxies sit in front of the process. It
decides whether the client address comes from `X-Forwarded-For`, which both the
rate-limit buckets and the request log depend on — behind nginx or on Railway,
leaving it `false` collapses every client into the proxy's address.

`MONGO_SERVER_SELECTION_TIMEOUT_MS` is deliberately far below the driver's own
30 seconds: it is a bound on time a conversion would spend looking for a
database it does no more than write a record to.

`HISTORY_OPERATION_TIMEOUT_MS` bounds the command itself, which server selection
does not. Mongoose's `readyState` reports the topology it last observed, so for
up to two heartbeats after a server disappears the connection still reads as
`connected` — and a server that answers slowly never leaves that state at all.
The deadline is what makes both cases degrade exactly like a disconnected store:
the write is dropped with the same one-per-outage warning, and the read answers
`503 HISTORY_UNAVAILABLE` with `reason: "timeout"`.

`HISTORY_TTL_DAYS` drives the TTL index on that collection — a log nobody prunes
grows without bound, and nothing reads a conversion from a month ago.

## 9. API module layout

```
apps/api
├── src
│   ├── main.ts                  bootstrap: pino logger, swagger, shutdown hooks
│   ├── listen-or-exit.ts        listen, or flush the buffered logs, name the port and exit 1
│   ├── configure-http.ts        trust proxy, request id, helmet, CORS and the api/v1 prefix, shared with the e2e suite
│   ├── app.module.ts
│   ├── config/                  zod schema, typed AppConfig, ConfigModule setup
│   ├── common/
│   │   ├── http/                the paths the process serves: the api prefix, the two probe routes, the docs —
│   │   │                        read by configure-http, setup-swagger and the request log level alike
│   │   ├── conversion/          ConversionStrategyName and the OpenAPI option objects a conversion response
│   │   │                        and a stored record of one publish identically
│   │   ├── warnings/            ResponseWarning, its DTO and collectWarnings — the §3 codes
│   │   ├── currency/            CurrencyCode, Currency and the ISO 4217 table, read by the
│   │   │                        Monobank mapper and the currencies projection alike
│   │   ├── errors/              AppError, ErrorCode, concrete errors
│   │   ├── filters/             GlobalExceptionFilter and ErrorResponseDto, with the status → code
│   │   │                        and payload → message mapping beside them in http-exception-mapping.ts
│   │   ├── guards/              ApiKeyGuard and the x-api-key header it reads
│   │   ├── logging/             nestjs-pino setup, log level, request-id.ts (the header, the
│   │   │                        sanitiser, the assigner, the middleware), serializers.ts (what
│   │   │                        reaches a log line, errorStack included) and createOutageReporter
│   │   ├── validation/          ValidationPipe options and the exception factory that flattens
│   │   ├── throttling/          buildThrottlerOptions and the global guard
│   │   ├── swagger/             OpenAPI document, ApiErrorResponses decorator
│   │   ├── resilience/          retry, CircuitBreaker, CircuitOpenError
│   │   ├── money/               the Money constructor, roundHalfUp and the decimal scales §3 publishes (big.js)
│   │   └── utils/               constant-time compare, withTimeout, TimeoutError
│   ├── infrastructure/
│   │   ├── redis/               create-redis-client.ts (the ioredis client and its REDIS_CLIENT
│   │   │                        token) and the RedisConnection lifecycle
│   │   └── mongo/               MongooseModule.forRootAsync, the connect options
│   │                             and the MongoConnection lifecycle
│   └── modules/
│       ├── currencies/
│       │   ├── dto/             CurrencyDto, CurrenciesResponseDto
│       │   ├── collect-currencies.ts  snapshot → sorted currency list
│       │   ├── currencies.controller.ts  GET /currencies
│       │   └── currencies.module.ts
│       ├── rates/
│       │   ├── domain/          exchange-rate.ts — ExchangeRate, RatesSnapshot, RatesSource,
│       │   │                    BASE_CURRENCY and the RatesLookup a caller reads `cacheDegraded`
│       │   │                    off; ports.ts — the provider and cache seams with their tokens
│       │   │                    and CachedSnapshot / CacheWrite
│       │   ├── dto/             ExchangeRateDto, RatesSnapshotResponseDto
│       │   ├── infrastructure/
│       │   │   ├── monobank/    provider, zod payload schema, mapper, retry predicate
│       │   │   ├── cached-rates-snapshot.schema.ts  zod schema for a cached value
│       │   │   ├── rates-cache-keys.ts
│       │   │   └── redis-rates.repository.ts
│       │   ├── application/     RatesService, describeRatesFailure
│       │   ├── rates.controller.ts  GET /rates, DELETE /rates/cache
│       │   └── rates.module.ts
│       ├── conversion/
│       │   ├── domain/          ConversionRequest, ConversionResult and the ConversionOutcome that
│       │   │                    carries it out of the service with what degraded beside it
│       │   ├── dto/             ConvertRequestDto, ConvertResponseDto (class-validator + swagger)
│       │   ├── strategies/      conversion-strategy.ts (the interface and its
│       │   │                    CONVERSION_STRATEGIES token), identity, direct, cross,
│       │   │                    the resolver, findRate and directionalRate, which is the §5
│       │   │                    table in one function
│       │   ├── conversion.service.ts
│       │   ├── conversion.controller.ts  POST /convert
│       │   └── conversion.module.ts
│       ├── history/
│       │   ├── domain/          ConversionRecord, the HistoryRepository port and its token
│       │   ├── schemas/         the Mongoose schema and its TTL index, built
│       │   │                    per deployment from HISTORY_TTL_DAYS
│       │   ├── infrastructure/  MongoHistoryRepository, HistoryIndexes
│       │   ├── dto/             HistoryQueryDto, ConversionRecordDto, HistoryResponseDto
│       │   ├── history.service.ts
│       │   ├── history.controller.ts  GET /history
│       │   └── history.module.ts
│       └── health/              controller, HealthExceptionFilter, pingIndicator with the probe
│                             budget, HealthIndicatorPort and its HEALTH_INDICATORS token,
│                             Redis / Mongo / Monobank indicators
└── test
    ├── e2e/                     supertest suites over the real HTTP surface
    │   ├── create-e2e-app.ts    boots through the same configureHttp and setupSwagger main.ts uses
    │   ├── override-*.ts        swaps Redis, the Mongo connection and the history repository for fakes
    │   ├── setup-e2e-env.ts     the environment every suite starts from
    │   ├── env/                 per-suite environment, imported before AppModule
    │   └── fixtures/            reads the shared snapshot and golden vectors at the repo root
    ├── integration/             the two adapters against a real Redis and Mongo; skipped, visibly, unless
    │                            INTEGRATION_REDIS_URL / INTEGRATION_MONGO_URL are set
    ├── openapi-document.ts      generates and serialises the document docs/openapi.json holds
    ├── write-openapi.ts         `npm run openapi:write`
    ├── jest-e2e.json
    └── jest-integration.json
```

Two things the API is tested against live outside it, because a second app reads
them too: `fixtures/rates-snapshot.json` and `fixtures/golden-conversions.json`
at the repository root (§11), and `docs/openapi.json`, the committed contract
the web suite validates its own fixtures against.

The dependencies between the feature modules run one way, and these are all of
them:

| Edge | What crosses it |
| ---- | --------------- |
| `conversion → rates` | `RatesModule` and `RatesService` for the snapshot, `ExchangeRate` and `BASE_CURRENCY` for the strategies, `RatesSource` on the result |
| `conversion → history` | `HistoryModule` and `HistoryService.record`, the side effect of a conversion (§2) |
| `currencies → rates` | `RatesModule` and `RatesService` for the snapshot, `ExchangeRate` and `BASE_CURRENCY` for the projection |
| `health → rates` | `MONOBANK_CIRCUIT_BREAKER`, taken from that module's exports rather than from its infrastructure folder |
| `history → rates` | `RatesSource`, because a record carries the provenance the conversion was answered with (§3) |

Every one of them points at `rates`, or from `conversion` at `history`, and
`rates` imports from no other feature module: the graph has no cycle, which is
what makes "one way" a fact rather than an intention. `apps/api` has no test
that enforces it; a grep of the relative imports under `modules/` is what
reproduces the table.

What is shared by more than one of them is vocabulary, and vocabulary lives in
`common/`: the ISO 4217 table and `CurrencyCode` the Monobank mapper and the
currencies projection both read, `ConversionStrategyName`, which a record names
as well as a conversion, and the `@ApiProperty` option objects the convert
response and the record DTO publish their eight common fields with. Nothing
under `common/` imports from `modules/`, which is what keeps that a one-way
street too — the `docs` and probe paths moved there for the same reason, so
`setup-swagger.ts` and `resolve-log-level.ts` no longer reach back into the
application root for them.

`ConversionRecordDto` declares its own properties rather than inheriting the
convert response's: a DTO of one module extending another's is an edge like any
other, and it was one this table could not have named.

Unit tests are not in that tree: each one lives in a `__tests__` folder beside
the code it covers, so `src/common/filters/global-exception.filter.ts` is tested
by `src/common/filters/__tests__/global-exception.filter.spec.ts`.

Conversion persists a `ConversionRecord` after a successful conversion. The
write is awaited, so a client that reads `/history` straight after a conversion
finds it there. It is not guarded again at the call site: `HistoryService.record`
never rejects — a store that cannot take the record logs it and resolves `false`
— so a Mongo failure costs a log line, a `HISTORY_NOT_RECORDED` warning on the
response (§3) and nothing else.

Awaiting is only safe because nothing on that path waits for a database that is
down, which is what the Mongo module is built for:

- the connection is opened without being awaited (`lazyConnection`), so the API
  boots and converts with Mongo unreachable;
- `bufferCommands: false` and a short `MONGO_SERVER_SELECTION_TIMEOUT_MS` keep a
  command from queueing or from spending the driver's default 30 seconds;
- the repository checks the connection state before issuing one at all, because
  even a fast failure costs the server-selection budget. A skipped record warns
  once per outage rather than once per conversion. `withTimeout` stops waiting
  but cannot cancel the work, so a write that timed out may still land: a
  conversion reported as not recorded can appear in `/history` a moment later;
- `MongoConnection` logs the state on change and retries an initial connection
  that never opened. The driver restores a connection it has opened before but
  not one that failed first, so without the retry the history would stay down
  until the next deploy because Mongo happened to be starting when the API did;
- index creation is explicit (`autoIndex: false`). With buffering disabled
  mongoose's automatic build runs against a connection that is still opening,
  fails, and swallows the rejection, which would leave the TTL index quietly
  missing. `HistoryIndexes` reconciles with `syncIndexes` once the connection is
  open — the expiry is configuration, and a changed `HISTORY_TTL_DAYS` is an
  options conflict for `createIndexes`.

The collection is `conversions`, with one index: `{ createdAt: -1 }` carrying
`expireAfterSeconds`. A single-field index is read in either direction, so the
newest-first page and the retention ride on the same key rather than on two.

## 10. Web app

- React 19, Vite, TypeScript strict, Tailwind CSS, React Router, TanStack Query,
  i18next + react-i18next.
- Routes: `/` converter (form, result card, recent conversions), `/about`
  reviewer page (what was built, why, links to repo / API docs / health).
- Runtime configuration: `public/config.js` sets `window.__APP_CONFIG__.apiUrl`;
  the Docker image regenerates it from `API_URL` at container start so the same
  image runs locally and on Railway. The value is JSON-escaped as it is written,
  so a quote in the URL cannot break the file.
- **Ports and adapters, client side.** `src/api/repositories/repositories.ts`
  declares one interface per resource (`ConversionRepository`,
  `CurrenciesRepository`, `RatesRepository`, `HistoryRepository`,
  `HealthRepository`) and the `Repositories` aggregate;
  `createHttpRepositories.ts` holds an HTTP implementation factory each, bound
  through a React context
  (`RepositoriesProvider` / `useRepositories`). `src/api/hooks` wraps them in
  TanStack Query hooks (`useConvert`, `useCurrencies`, `useRatesSnapshot`,
  `useHistory`, `useHealth`) that depend only on the interfaces. `src/api/http` is the only place that knows about `fetch`; a
  component imports nothing from it but the `ApiError` and field-error types it
  renders.
- `GET /health` goes through that same transport, with `[200, 503]` passed as
  its accepted statuses: both carry the terminus report, so a degraded API is
  rendered indicator by indicator instead of as unreachable. A transport
  failure, a body that does not parse and a report that fails its guard are the
  only errors, each carrying the status it arrived on, and the query does not
  retry.
- **Two-layer fallback.** The API survives Monobank being down with the stale
  Redis copy; the browser survives the API being down with a persisted one. The
  `rates` and `currencies` queries are written through to `localStorage`
  (`@tanstack/query-sync-storage-persister`, 7-day `maxAge`, busted by the
  package version, and skipped entirely when storage is unavailable). A
  conversion that fails with `NETWORK_ERROR` or a 5xx is re-priced from that
  snapshot by `convertOffline` — §5 rule for rule, on a `big.js` constructor
  configured like the API's `Money` — and shown with
  a warning-tone `offline-estimate` source badge and the age of the rates; every
  other envelope code is left as the API answered it, and an estimate is never
  added to the history. The currency selects fall back the same way: the API's
  list, then the persisted copy, then the two defaults.
- **The amount field** (`features/converter/lib/amount/`). `formatAmountInput(raw, caret)` is the one rule for what
  the field may hold: everything that is not a digit or the locale's decimal
  separator is dropped — letters, signs, a second separator, a third decimal —
  the integer part is capped at the width of `MAX_AMOUNT`, thousands are grouped
  with the separator `Intl` reports for the active language, and the caret is
  put back after the same number of significant characters it had passed, so
  typing inside a grouped number does not throw it to the end. Backspace and
  Delete landing on a group separator take the digit beside it, which the
  regrouping would otherwise put straight back. What an amount *means* is still
  `parseAmount`'s rule alone, and it is what answers `tooLarge`; the field only
  keeps characters no amount can contain from being typed at all.
  The two do not read the same string, so one step stands between them:
  `canonicalAmount(value, separators)` drops the group mark, normalises the
  decimal mark to `.` and drops a decimal mark with no digits behind it, and the
  form parses **that**. Without it the field's own output is ambiguous — under
  `{group: '.', decimal: ','}` the `1.234` it writes for 1234 parses as 1.234, a
  silent 1000× error — and a half-typed `12.` submitted with Enter, which does
  not blur, parses as nothing at all. Blur still trims a dangling separator, but
  only so the field looks finished; correctness does not depend on it.
- **Provenance in the client.** The result card prints the rate in both
  directions — the API publishes one, and `inverseRate` (in
  `features/converter/lib/money.ts`, beside the scoped `big.js` constructor and
  the decimal scales) computes the other on
  the same `big.js` constructor, rounded half-up to the six places §3 uses — and
  draws the hops the strategy took. The history panel shows each entry's
  `source` for the same reason §3 stores it.
- **Warnings.** §3's `warnings` array is a successful answer saying what
  degraded while it was produced, so it is rendered as a footnote and never as
  a failure: warn-tone notes at the foot of the result card for a conversion's,
  and one line under the form — beside the currency-list hint — for the ones
  `/currencies` and `/rates` carry, deduplicated by code because a cache that is
  down is down for both. The sentence shown is the translated one for a code
  this client knows (`warnings.*` in `en.json`) and the server's own for a code
  it does not, the same bargain the error envelope makes.
- **Internationalisation.** Every user-facing string lives in
  `src/i18n/en.json`, loaded through `react-i18next`; the `CustomTypeOptions`
  augmentation type-checks keys against the JSON. Numbers and dates are
  formatted with `Intl` in the active language, and the document's `lang`
  attribute follows i18next's resolved language. Adding a language is a new JSON
  file plus a language switch, with no component changes. API failures map the
  envelope `code` to a translated message and fall back to the server `message`;
  `details.errors` entries are shown as returned, and the ones naming `amount`,
  `from` or `to` are routed onto that input, where they clear as soon as the
  user edits the field they describe.
- Feature folders carry their own structure (`components/`, `hooks/`, `lib/`,
  `__tests__/`); shared test helpers and fakes live in `src/test/`.
- Tests: Vitest + Testing Library, rendered through the i18n and repository
  providers with in-memory repository fakes, plus fetch-level tests asserting
  the URL, method, headers and body of every endpoint.

## 11. Testing strategy

| Layer                | Tool                         | What is covered                                   |
| -------------------- | ---------------------------- | ------------------------------------------------- |
| Unit (api)           | Jest                         | resilience primitives, mapper, provider, repository, rates service flows, every strategy, resolver, conversion service, history, filter, guard, config schema, health indicators |
| E2E (api)            | Jest + supertest             | eight suites — `app` (envelope, request ids, unparseable bodies, unknown routes, `/health` and `/health/live` while the dependencies report down), `conversion` (pricing, validation, unsupported and no-path, upstream down, cache unreachable), `rates` (cache hit, stale fallback, invalidation and its auth, cache unreachable, `/currencies`), `history` (record, ordering, paging, store unreachable), `http-hardening`, `throttling`, `swagger`, `openapi-contract` |
| Unit (web)           | Vitest + Testing Library     | amount parsing and input formatting, form validation, per-field server errors, result display, the inverse rate and provenance fallbacks, error display, history list and its loading and empty states, health rendering, every HTTP repository |
| Integration (api)    | Jest against real servers    | the two adapters nothing else exercises for real — the TTLs both cache keys are written with, the round trip through them, `clear`, a corrupt value read back as a miss; the `{ createdAt: -1 }` index and its `expireAfterSeconds` after `syncIndexes`, the record-and-read-back mapping, the newest-first page, the clamp. Each suite runs on its own database — Redis 15, a Mongo database of its own — so a URL pointed at a running stack is never flushed. Skipped, with a `SKIPPED:` line naming the variable, unless `INTEGRATION_REDIS_URL` / `INTEGRATION_MONGO_URL` are set, and an error rather than a skip under `CI`, whose `orchestration` job points them at the stack it already starts |
| Contract             | Jest (api) + ajv (web)       | `docs/openapi.json` regenerated from the application's decorators and compared with the committed file; on the web side every sample response the suite renders validated against the schema that document publishes for its route |

A `*.module.ts` is wiring and is excluded from coverage, so anything a module
*decides* lives in a file of its own beside it — `buildMonobankHttpOptions`,
`buildMonobankCircuitBreaker`, `buildConfiguredConversionRecordSchema` — where
the gate can see it. A factory that only hands back what was injected into it
decides nothing, and a spec asserting that it does so is a tautology, so the
two of those stay inline in their modules: the order of `CONVERSION_STRATEGIES`
is asserted by resolving the token through a testing module, which is where the
`inject` list and the parameters it fills can actually disagree.

Coverage threshold: 85% lines/branches for `apps/api` in the Jest config, and
90% statements/branches/functions/lines for `apps/web` in the Vitest config; CI
runs the coverage script, not the plain one, plus `format:check`. The API
report covers the unit suites alone: `test:e2e` runs uninstrumented, so
`configure-http.ts` and `setup-swagger.ts` read 0% in it while every e2e suite
boots through both. The gate is on the unit numbers, and the e2e suites are the
surface they cannot reach.
Unit tests never touch the network, Redis or Mongo. The e2e suites do not
either: the shared factory swaps the Redis client, the Mongo connection and the
history repository for in-process fakes, and the environment points every url
at a dead host, so a suite that forgets an override fails instead of passing
against whatever a developer happens to be running.

The integration suites are the deliberate exception, and the reason they exist:
a fake can only confirm the assumption its author had about the driver. They are
opt-in by environment variable, so nothing about the two paragraphs above
changes for anyone who has not started a Redis and a Mongo.

**One set of numbers for two implementations of §5.** `convertOffline` in the
browser and the conversion route on the server price the same rule, and each
used to be tested against its own hand-copied rates table — which had already
drifted on two of the five pairs. Both now read
`fixtures/rates-snapshot.json` and assert every row of
`fixtures/golden-conversions.json`: twelve vectors computed once from §5,
covering identity, both directions of a spread pair, both directions of a
cross, a result below half a cent, and the million-hryvnia case that only
passes if the money is computed from the unrounded rate. `npm run
check:fixtures` at the root validates both files, cross-references every
vector's currencies against the pairs the snapshot publishes, and re-prices all
twelve from the snapshot in exact integer arithmetic. That re-pricing is a third
derivation of the rule above rather than a copy of either implementation: with
only the two, a transcription slip in the table is something both suites would
agree on and both would have wrong.

## 12. Conventions

- Conventional Commits (`feat(api): …`, `fix(web): …`, `refactor(api): …`,
  `test(web): …`, `chore: …`, `ci: …`, `docs: …`). The subject says what changed;
  the body says why, and is where a decision that is not obvious from the diff
  gets argued.
- Every change lands through a pull request into `main`; CI must be green. The
  `npm audit` step in `ci.yml` is advisory rather than part of that gate,
  because an advisory is published against a lockfile the PR did not
  necessarily touch; `audit.yml` runs the same check weekly (and on demand) as
  a blocking job instead.
- The implementation was AI-assisted under human direction and review: this
  document was written first and each pull request was reviewed against it. The
  commits carry a `Co-Authored-By` trailer naming the assistant, so the record
  is in the history rather than in a footnote.
- ESLint + Prettier, `noImplicitAny`, `strictNullChecks`, no `any`, no
  non-null assertions outside tests.
- A file holds one **reason to change**, which is usually but not always one
  export. A DI token lives in the file that declares the port it injects, a
  helper used by exactly one caller lives in that caller, and a group of types
  that change together — the rates domain's `exchange-rate.ts` and `ports.ts`,
  the web's `repositories.ts` — is one file rather than one per declaration. A
  file is not free: every one of them is a name to know and a hop to follow.

### Tests

- Unit tests live in a `__tests__` folder next to the code they cover:
  `src/common/filters/__tests__/global-exception.filter.spec.ts`.
- End-to-end tests live in `apps/api/test/e2e` and boot through `createE2eApp`,
  which applies the same `configureHttp` and `setupSwagger` that `main.ts` does,
  so the surface under test is the one the process serves.
- Integration tests live in `apps/api/test/integration` and are the only ones
  that reach a real Redis or MongoDB. They run when
  `INTEGRATION_REDIS_URL` / `INTEGRATION_MONGO_URL` point at one; otherwise each
  writes a `SKIPPED: … set <VARIABLE> …` line to stdout, because Jest reports
  nothing per suite for a file whose every suite is skipped. Under `CI` a
  missing variable throws instead, so deleting the workflow's env block fails
  rather than silently stopping.
- A test asserts behaviour, not the literal it imported. A spec that reads a
  configuration object back cannot fail when the wiring around it is wrong,
  which is how a Redis client that could never serve its first command passed
  its own suite.

### API documentation

`test/e2e/swagger.e2e-spec.ts` is what keeps `/docs` honest, and every new route
extends it:

- add the route to its `EXPECTED_PATHS` list (`[['/health', 'get']]`). A route
  the API serves but does not document — or documents but does not serve —
  fails the test.
- every DTO property carries `@ApiProperty` / `@ApiPropertyOptional` with a
  description and an example.
- every failure a route can answer with is declared through
  `@ApiErrorResponses(...statuses)`, which points each entry at
  `ErrorResponseDto`; the envelope is never re-described per route.
- a route behind `ApiKeyGuard` carries `@ApiSecurity('admin')`, the scheme
  `buildSwaggerConfig` registers for the `x-api-key` header.

### Web

- Every user-visible string lives in `src/i18n/en.json` and is read through
  i18next (`useTranslation`). The key type is derived from that file, so a
  missing or misspelled key is a compile error. No copy is written inline in a
  component.
- Data access is layered and each layer is the only one that knows its concern:
  `src/api/http` is the fetch client (base url, headers, decoding the error
  envelope), `src/api/repositories` holds one interface per resource
  (`ConversionRepository`, `CurrenciesRepository`, `RatesRepository`,
  `HistoryRepository`, `HealthRepository` — together in `repositories.ts`, since
  a route added to the API is one method in each) with the HTTP implementations
  in `createHttpRepositories.ts`, handed to the tree through a provider, and
  `src/api/hooks` exposes the TanStack Query hooks
  components consume (`useConvert`, `useCurrencies`, `useRatesSnapshot`,
  `useHistory`, `useHealth`). A component never fetches.
- Tests inject a fake repository through that same provider rather than mocking
  `fetch` or the network, so a component test never depends on the transport.
- The persisted query cache is busted by the version in `apps/web/package.json`,
  which is what discards copies written against an older API contract: a release
  that changes a persisted response shape has to bump that version, or browsers
  hydrate the previous shape into code that no longer reads it.

## 13. Requirements mapping

The original task is eight numbered sections; each of their atoms is traced to
the code, the test and the live URL that satisfies it in the **Requirements
traceability** table of [`README.md`](../README.md#requirements-traceability) —
30 atoms, all met, re-verified against the current `main` rather than copied
forward. It lives there rather than here because it is what a reviewer reads
first and because it cites test names, which drift faster than design does;
duplicating it would give the project two versions of the same claim.

This document is the other half of that answer: the table says *where* a
requirement is met, and the sections above say *why* it is met that way.

## 14. Known limitations and follow-ups

Nothing below is a defect against the task. They are the places where a
deliberate scope line was drawn, and each is the first thing to move if the
project were taken further.

**Runtime and scale**

- **Breaker and throttle state are per process.** `CircuitBreaker` holds its
  state in memory and `@nestjs/throttler` uses its default in-process storage,
  so with more than one replica each has its own breaker and its own buckets:
  the documented `THROTTLE_LIMIT` becomes per replica, and one instance can be
  OPEN while another still calls the upstream. Correct for the single instance
  this deploys as; a second one wants both moved into Redis.
- **The cache is one global snapshot.** `rates:latest` holds the whole
  snapshot, so `DELETE /rates/cache` is all-or-nothing and there is no
  per-currency invalidation. That matches an upstream that publishes every pair
  in one document and allows one request a minute; a source with per-pair
  endpoints would want per-pair keys.
- **History paging is a limit, not a cursor.** `GET /history` answers the
  newest `1..50` and has no offset or cursor, so there is no way to read past
  the first page. Deliberate for a demo surface, and the `{ createdAt: -1 }`
  index is already the one a cursor would ride on.
- **A timed-out history write may still land.** `withTimeout` stops waiting but
  cannot cancel the work, so a conversion answered with `HISTORY_NOT_RECORDED`
  can appear in `/history` a moment later (§9). The warning is honest about
  what was observed, not about what the database eventually did.

**Security posture**

- **`ApiKeyGuard` is a no-op while `ADMIN_API_KEY` is unset.** The schema's
  `superRefine` refuses to start a `production` process without one, so the
  exposure is bounded to a deployment deliberately run as `development` or
  `test`. There is no per-caller auth on the read routes at all, which is the
  right scope for a public rate converter and the wrong one for anything with a
  user in it.
- **Swagger is served in production, by design.** `/docs` and `/docs-json` are
  public on the deployment because the API is a portfolio surface a reviewer is
  meant to explore. A real service would gate them or publish the document out
  of band.

**Testing**

- **No browser end-to-end layer.** There is no Playwright or Cypress suite; the
  web tests are component-level with repository fakes injected through the real
  provider, and the API e2e suites stop at supertest. The one thing nothing
  covers automatically is the two running together in a browser — that path is
  exercised by CI's `orchestration` job as far as `/health` and the two
  container-backed integration suites, and by hand otherwise.
- **The integration suites cover the two adapters, not the two modules.** They
  exercise `RedisRatesRepository` and `MongoHistoryRepository` directly rather
  than through a booted app, so what they check is the driver behaviour the
  fakes stand in for. The wiring above them is still e2e's job, against fakes.
- **E2E coverage is not merged into the unit report.** `test:e2e` runs
  uninstrumented, so `configure-http.ts` and `setup-swagger.ts` read 0% in a
  report whose gate they are not the subject of (§11). Merging the two reports
  would make the number honest; leaving them apart keeps the gate on the logic.
- **Live-deployment smoke is manual.** Nothing polls the Railway services; the
  numbers in the README were captured by hand.

**Client**

- **The amount field breaks native undo.** `formatAmountInput` rewrites the
  input's value on every keystroke, which clears the browser's own undo stack,
  so ⌘Z in that field does not restore what was typed. Fixing it means driving
  the edits through `document.execCommand('insertText')` or keeping an undo
  stack by hand.
- **The persister API is deprecated upstream.** `createSyncStoragePersister`
  from `@tanstack/query-sync-storage-persister` carries an `@deprecated` tag in
  the installed version pointing at `createAsyncStoragePersister`. It works and
  is tested; the migration is a follow-up, not a fix.
- **The offline estimate is a second implementation of §5.** `convertOffline`
  reimplements the pricing rules in the browser on a `big.js` constructor
  configured like the API's `Money`. That is what makes an estimate possible
  with the API unreachable, and it is also a rule in two places that can drift.
  Both now assert the same golden vectors from one shared fixture set (§11), so
  a number that moves on one side fails on both — but the *rule* is still
  written twice, and only the cases in that table are pinned. Extracting it to a
  package both apps consume is the fix; the fixtures are the mitigation.

**Documentation**

- **This document and the code are kept in step by review, not by a test.**
  Only the API surface has mechanical checks: `swagger.e2e-spec.ts` fails on a
  route documented but not served, or served but not documented, and
  `openapi-contract.e2e-spec.ts` fails when `docs/openapi.json` no longer
  matches what the decorators generate. Everything else here is prose a reviewer
  has to keep true.
- **The web's types are checked against the contract, not generated from it.**
  `apps/web/src/api/types.ts` is still hand-written; what the ajv test proves is
  that the bodies the suite renders would be accepted by the published schemas,
  not that every field of every type is right. Generating the types from
  `docs/openapi.json` would close the remaining half.
