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

| Path              | What                                                     |
| ----------------- | -------------------------------------------------------- |
| `apps/api`        | NestJS 11, TypeScript strict, REST API                   |
| `apps/web`        | React 19 + Vite + TypeScript SPA                         |
| `docker-compose.yml` | api, web, redis, mongo for local orchestration        |
| `docs/`           | This document and the API reference                      |
| `.github/workflows` | CI: lint, typecheck, unit + e2e tests, build per app   |

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
- **Graceful degradation.** Redis or Mongo being down never breaks a
  conversion; it is logged, surfaced on `/health`, and the request still
  succeeds when the upstream (or a stale copy) is reachable.
- **One error envelope** for every failure, produced by a global exception
  filter from a small hierarchy of typed domain errors.
- **Strict typing, small files, no comments that restate the code.** Comments
  are reserved for non-obvious *why*s.

## 3. API contract

Base path: `/api/v1`. All responses are JSON. Swagger UI at `/docs`,
OpenAPI JSON at `/docs-json`.

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
  "result": 84.73,
  "rate": 0.847312,
  "strategy": "cross",
  "source": "cache",
  "ratesTimestamp": "2026-09-08T12:00:00.000Z"
}
```

- `rate` is the effective `to`-per-`from` rate, rounded to 6 decimals.
- `result` is `amount × rate`, rounded half-up to 2 decimals. Arithmetic uses
  `big.js`; floating point is never used for money.
- `strategy`: `identity` | `direct` | `cross`.
- `source`: `cache` | `provider` | `stale-cache`.

### GET `/api/v1/rates`

Returns the current snapshot the service would convert with:

```json
{
  "source": "cache",
  "fetchedAt": "2026-09-08T12:00:00.000Z",
  "rates": [
    { "base": "USD", "quote": "UAH", "buy": 44.35, "sell": 44.831, "date": "…" },
    { "base": "GBP", "quote": "UAH", "cross": 60.7562, "date": "…" }
  ]
}
```

### DELETE `/api/v1/rates/cache`

Invalidates both cache keys. Returns `204`. If `ADMIN_API_KEY` is configured
the request must carry it in the `x-api-key` header (`401` otherwise).

### GET `/api/v1/currencies`

Currencies present in the current snapshot plus `UAH`, sorted by code:

```json
{ "currencies": [{ "code": "EUR", "numericCode": 978, "name": "Euro" }] }
```

### GET `/api/v1/history?limit=10`

Most recent conversions, newest first. `limit` is `1..50`, default `10`.

```json
{ "items": [{ "id": "…", "from": "EUR", "to": "GBP", "amount": 100, "result": 84.73, "rate": 0.847312, "strategy": "cross", "createdAt": "…" }] }
```

### GET `/health`

`@nestjs/terminus` response with indicators `redis`, `mongodb`, `monobank`.

- `redis` — `PING` under a short budget of its own. `up`, or `down` with the
  reason `ping failed` or `timeout`.
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

`/health` is also exempt from the throttler (`@SkipThrottle()`). A liveness probe
runs far more often than a client, and sharing a bucket with one would let the
rate limit restart a healthy process.

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

| HTTP | `code`                 | When                                              |
| ---- | ---------------------- | ------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | DTO validation failed; `details.errors` lists fields |
| 401  | `UNAUTHORIZED`         | Missing/invalid admin API key                     |
| 403  | `FORBIDDEN`            | The caller may not perform this operation         |
| 404  | `NOT_FOUND`            | Unknown route                                     |
| 422  | `UNSUPPORTED_CURRENCY` | Code is not in the snapshot                       |
| 422  | `RATE_NOT_AVAILABLE`   | No path between the two currencies                |
| 429  | `TOO_MANY_REQUESTS`    | Throttler limit exceeded                          |
| 503  | `RATES_UNAVAILABLE`    | Upstream failed and no stale copy exists          |
| 500  | `INTERNAL_ERROR`       | Anything unexpected; message is generic           |

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
interface RatesRepository {
  getFresh(): Promise<RatesSnapshot | null>;
  getStale(): Promise<RatesSnapshot | null>;
  save(snapshot: RatesSnapshot): Promise<void>;
  clear(): Promise<void>;
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
```

- Concurrent callers during a miss share one in-flight promise, cleared in a
  `finally` so a failed refresh does not strand the caller behind it.
- `RatesUnavailableError` carries a `details.reason` that names the resilience
  decision — `upstream circuit open` or `upstream request failed` — and never
  the upstream's own message, which travels to the client in the envelope and
  carries the url, the status text and sometimes the body.
- Every `RatesRepository` method catches Redis errors, logs a warning with the
  operation name, and degrades (`null` on reads, no-op on writes).

### Redis keys

| Key               | TTL env                    | Default |
| ----------------- | -------------------------- | ------- |
| `rates:latest`    | `RATES_CACHE_TTL_SECONDS`  | 300     |
| `rates:fallback`  | `RATES_STALE_TTL_SECONDS`  | 86400   |

Both are written on every successful upstream fetch. `DELETE /rates/cache`
removes both. Values are the JSON-serialised `RatesSnapshot`.

## 5. Conversion semantics

Monobank publishes `1 base = X quote`. `rateBuy` is the price at which the bank
buys `base`; `rateSell` is the price at which it sells `base`; `rateCross` is
a mid rate for pairs without a spread. From the client's point of view:

| Direction            | Multiply amount by                     |
| -------------------- | -------------------------------------- |
| `base → quote`       | `buy ?? cross`                         |
| `quote → base`       | `1 / (sell ?? cross)`                  |

Strategies, tried in order by `ConversionStrategyResolver`:

1. **`IdentityStrategy`** — `from === to` → rate `1`.
2. **`DirectPairStrategy`** — a rate exists for `(from, to)` or `(to, from)`
   (e.g. `USD/UAH`, `UAH/USD`, `EUR/USD`).
3. **`CrossRateStrategy`** — both `from` and `to` have a pair against the base
   currency `UAH`; rate = `rate(from→UAH) × rate(UAH→to)`.

If no strategy applies: `UNSUPPORTED_CURRENCY` when a code is absent from the
snapshot entirely, otherwise `RATE_NOT_AVAILABLE`.

```ts
interface ConversionStrategy {
  readonly name: 'identity' | 'direct' | 'cross';
  supports(from: CurrencyCode, to: CurrencyCode, rates: ExchangeRate[]): boolean;
  rate(from: CurrencyCode, to: CurrencyCode, rates: ExchangeRate[]): Big;
}
```

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
  `MONOBANK_CIRCUIT_BREAKER` token and exported by `MonobankModule`, so the
  health indicator reports the breaker the provider actually trips rather than
  one of its own that nothing ever opens.
- **Timeout** on every upstream request (`MONOBANK_TIMEOUT_MS`), and an overall
  budget on the whole call (`MONOBANK_TOTAL_BUDGET_MS`, 8 s):
  `withTimeout(retry(...), budget)` inside the breaker. The per-request timeout
  bounds one attempt, so the attempts plus the backoff between them add up to
  far longer than any of them, and single-flight makes every concurrent caller
  wait out the same sum — for a stale copy that was already in Redis when the
  first one arrived. The budget sits inside the breaker so an expiry counts as
  an upstream failure rather than passing through unnoticed.
- **Throttling** via `@nestjs/throttler` on all routes.
- **Single-flight** cache refresh (see §4) so a burst of misses produces one
  upstream call.

## 7. Errors and logging

```ts
abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly status: HttpStatus;
  constructor(message: string, readonly details?: Record<string, unknown>) {}
}
```

Concrete: `UnsupportedCurrencyError`, `RateNotAvailableError`,
`RatesUnavailableError`, `UnauthorizedError`. `CircuitOpenError` is internal
and is translated to `RatesUnavailableError` by `RatesService`.

`GlobalExceptionFilter` (registered with `APP_FILTER`):

- `AppError` → its status/code, message and details.
- Nest `HttpException` (validation, throttler, 404) → normalised into the
  envelope with the codes from §3.
- Anything else → `500 INTERNAL_ERROR`, generic message, full stack logged.

Logging uses `nestjs-pino`: JSON in production, `pino-pretty` in development,
one log line per request carrying exactly `requestId`, method, path, client
address, status and duration. Those fields are produced by custom
`serializers.req` / `serializers.res`; no header is ever written, so a
credential cannot reach the log by being forgotten in a denylist. Services use
the injected `PinoLogger` with a context.

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

## 9. API module layout

```
apps/api
├── src
│   ├── main.ts                  bootstrap: pino logger, swagger, shutdown hooks
│   ├── configure-http.ts        trust proxy, request id, helmet, CORS and the api/v1 prefix, shared with the e2e suite
│   ├── app.module.ts
│   ├── config/                  zod schema, typed AppConfig, ConfigModule setup
│   ├── common/
│   │   ├── errors/              AppError, ErrorCode, concrete errors
│   │   ├── filters/             GlobalExceptionFilter, ErrorResponseDto, status → code mapping
│   │   ├── guards/              ApiKeyGuard
│   │   ├── logging/             nestjs-pino setup, request id middleware, log level, serializers
│   │   ├── validation/          ValidationPipe options, validation error flattening
│   │   ├── throttling/          buildThrottlerOptions and the global guard
│   │   ├── swagger/             OpenAPI document, ApiErrorResponses decorator
│   │   ├── resilience/          retry, CircuitBreaker, CircuitOpenError
│   │   └── utils/               money rounding helpers (big.js), constant-time compare, withTimeout
│   ├── infrastructure/
│   │   ├── redis/               REDIS_CLIENT (ioredis) and the RedisConnection lifecycle
│   │   └── mongo/               MongoModule (MongooseModule.forRootAsync)
│   └── modules/
│       ├── currencies/
│       │   ├── dto/             CurrencyDto, CurrenciesResponseDto
│       │   ├── iso-4217.ts      numeric↔alpha mapping and the ISO 4217 description
│       │   ├── currency.ts      Currency
│       │   ├── collect-currencies.ts  snapshot → sorted currency list
│       │   ├── currencies.controller.ts  GET /currencies
│       │   └── currencies.module.ts
│       ├── rates/
│       │   ├── domain/          ExchangeRate, RatesSnapshot, RatesSource, ports + tokens
│       │   ├── dto/             ExchangeRateDto, RatesSnapshotResponseDto
│       │   ├── infrastructure/
│       │   │   ├── monobank/    provider, zod payload schema, mapper, retry predicate, breaker token
│       │   │   ├── cached-rates-snapshot.schema.ts  zod schema for a cached value
│       │   │   ├── rates-cache-keys.ts
│       │   │   └── redis-rates.repository.ts
│       │   ├── application/     RatesService, describeRatesFailure
│       │   ├── rates.controller.ts  GET /rates, DELETE /rates/cache
│       │   └── rates.module.ts
│       ├── conversion/
│       │   ├── dto/             ConvertRequestDto, ConvertResponseDto (class-validator + swagger)
│       │   ├── strategies/      interface, identity, direct, cross, resolver
│       │   ├── conversion.service.ts
│       │   ├── conversion.controller.ts  POST /convert
│       │   └── conversion.module.ts
│       ├── history/
│       │   ├── schemas/         ConversionRecord (Mongoose)
│       │   ├── history.repository.ts  port + MongoHistoryRepository
│       │   ├── history.service.ts
│       │   ├── history.controller.ts  GET /history
│       │   └── history.module.ts
│       └── health/              controller, HealthIndicatorPort + Redis / Mongo / Monobank indicators
└── test
    ├── e2e/                     supertest suites over the real HTTP surface
    │   ├── env/                 per-suite environment, imported before AppModule
    │   └── fixtures/            snapshots the suites assert against
    └── jest-e2e.json
```

Unit tests are not in that tree: each one lives in a `__tests__` folder beside
the code it covers, so `src/common/filters/global-exception.filter.ts` is tested
by `src/common/filters/__tests__/global-exception.filter.spec.ts`.

Conversion persists a `ConversionRecord` after a successful conversion. The
write is awaited but wrapped: a Mongo failure is logged and the response is
still returned.

## 10. Web app

- React 19, Vite, TypeScript strict, Tailwind CSS, React Router, TanStack Query,
  i18next for every user-visible string.
- Routes: `/` converter (form, result card, recent conversions), `/about`
  reviewer page (what was built, why, links to repo / API docs / health).
- Runtime configuration: `public/config.js` sets `window.__APP_CONFIG__.apiUrl`;
  the Docker image regenerates it from `API_URL` at container start so the same
  image runs locally and on Railway.
- `src/api/` is the only place that knows about HTTP, layered
  `http` → `repositories` → `hooks`; components consume the typed hooks
  (`useConvert`, `useCurrencies`, `useHistory`). See §12.
- Tests: Vitest + Testing Library for the form, result rendering and error
  states, with a fake repository injected through the provider.

## 11. Testing strategy

| Layer                | Tool                         | What is covered                                   |
| -------------------- | ---------------------------- | ------------------------------------------------- |
| Unit (api)           | Jest                         | resilience primitives, mapper, provider, repository, rates service flows, every strategy, resolver, conversion service, history, filter, guard, config schema, health indicators |
| E2E (api)            | Jest + supertest             | `/convert` happy path, validation errors, unsupported currency, upstream down with/without stale cache, `/rates`, `/history`, `/health` |
| Unit (web)           | Vitest + Testing Library     | form validation, result display, error display, history list |

Coverage threshold for `apps/api`: 85% lines/branches enforced in Jest config;
nothing under a `__tests__` folder counts as source. Unit tests never touch the
network, Redis or Mongo.

## 12. Conventions

- Conventional Commits (`feat(api): …`, `fix(web): …`, `chore: …`, `docs: …`, `test(api): …`).
- Every change lands through a pull request into `main`; CI must be green.
- ESLint + Prettier, `noImplicitAny`, `strictNullChecks`, no `any`, no
  non-null assertions outside tests.
- Files are small and named after the single thing they export.

### Tests

- Unit tests live in a `__tests__` folder next to the code they cover:
  `src/common/filters/__tests__/global-exception.filter.spec.ts`.
- End-to-end tests live in `apps/api/test/e2e` and boot through `createE2eApp`,
  which applies the same `configureHttp` and `setupSwagger` that `main.ts` does,
  so the surface under test is the one the process serves.
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
  envelope), `src/api/repositories` holds one interface per resource with its
  implementation (`RatesRepository`, `ConversionRepository`,
  `HistoryRepository`) handed to the tree through a provider, and
  `src/api/hooks` exposes the TanStack Query hooks components consume
  (`useConvert`, `useCurrencies`, `useHistory`). A component never fetches.
- Tests inject a fake repository through that same provider rather than mocking
  `fetch` or the network, so a component test never depends on the transport.
