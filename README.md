# Currency Converter

[![CI](https://github.com/bkarkusashvili/currency-converter/actions/workflows/ci.yml/badge.svg)](https://github.com/bkarkusashvili/currency-converter/actions/workflows/ci.yml)

A currency converter built on the Monobank public exchange-rate API: a NestJS
REST API that caches rates in Redis behind a circuit breaker and records
conversion history in MongoDB, and a React SPA that talks to it. The point of
the repository is the engineering around the feature — ports and adapters on
both sides, one error envelope, resilience against a flaky upstream, a typed and
validated configuration surface, tests with coverage gates, and a stack that
comes up with one command locally and deploys from the same images.

## Live

| What                | URL                                                          |
| ------------------- | ------------------------------------------------------------ |
| Web app             | https://web-production-36ebc.up.railway.app                  |
| Reviewer page       | https://web-production-36ebc.up.railway.app/about            |
| Swagger UI          | https://api-production-c5b65.up.railway.app/docs             |
| OpenAPI JSON        | https://api-production-c5b65.up.railway.app/docs-json         |
| Dependency report   | https://api-production-c5b65.up.railway.app/health            |
| Liveness probe      | https://api-production-c5b65.up.railway.app/health/live       |

## What is here

Everything described in [`docs/architecture.md`](docs/architecture.md) is
merged on `main` and deployed. Every change landed through a pull request into
`main`, each carrying review comments anchored to the lines they concern and a
round of commits answering them before the author merged it with CI green;
GitHub does not allow approving your own pull request, so the record is those
comments and the fixes rather than an approval decision, and nothing was pushed
to `main` directly. Those pull requests built:

- **API** (`apps/api`) — NestJS 11, TypeScript strict. `POST /api/v1/convert`
  through a strategy chain (identity, direct pair, cross via UAH),
  `GET /api/v1/rates` over a Redis cache-aside with a long-lived stale fallback,
  `GET /api/v1/currencies`, `GET /api/v1/history` over MongoDB, `GET /health`
  with three indicators and `GET /health/live` for deploy gates. Retry with
  jittered backoff, an in-house circuit breaker and per-call budgets around
  Monobank; one error envelope for every failure; a `warnings` array that says
  what degraded on a request that still succeeded.
- **Web** (`apps/web`) — React 19, Vite, TanStack Query, i18next. Converter and
  `/about` pages, a repository layer mirroring the API's ports, and a persisted
  rates snapshot that keeps the converter answering when the API is unreachable.
- **Orchestration** — Docker Compose for `api`, `web`, `redis` and `mongo`; a
  dev overlay that runs the backing services alone; GitHub Actions running
  lint, format, typecheck, build, tests with coverage gates and an image build
  per app, plus a job that boots the whole Compose stack and probes it.

## Quick start

Node 24 (see [`.nvmrc`](.nvmrc)) and Docker with Compose v2.

### 1. Backing services in Docker, both apps from npm

```bash
npm ci && npm run setup   # root scripts, then apps/api and apps/web
npm run dev               # Redis and MongoDB in Docker, both apps from npm
```

`npm run dev` waits for Redis and MongoDB to report healthy, then runs the API
and the Vite dev server side by side with prefixed output. Ctrl-C stops both.
`npm run infra:down` stops the two containers afterwards.

| What    | URL                             |
| ------- | ------------------------------- |
| Web     | http://localhost:5173           |
| API     | http://localhost:3000/api/v1    |
| Swagger | http://localhost:3000/docs      |
| Health  | http://localhost:3000/health    |

### 2. The whole stack in Docker

Nothing but Docker — no Node install, no local Redis:

```bash
docker compose up --build   # or: npm run up, detached and waiting for health
```

| What    | URL                             |
| ------- | ------------------------------- |
| Web     | http://localhost:8080           |
| API     | http://localhost:3000/api/v1    |
| Swagger | http://localhost:3000/docs      |
| Health  | http://localhost:3000/health    |

Here Redis and MongoDB stay inside the network and are not published, and the
API waits for both to report healthy before it starts.

```bash
docker compose logs -f   # npm run logs
docker compose down      # npm run down — stop, keep the Redis and Mongo volumes
docker compose down -v   # npm run down:clean — stop and wipe them
```

### 3. One app at a time

In two terminals, both starting from the repository root:

```bash
cd apps/api && npm ci && npm run start:dev   # http://localhost:3000
```

```bash
cd apps/web && npm ci && npm run dev         # http://localhost:5173
```

Each app is an independent npm package with its own lockfile; the root
`package.json` is not a workspace, just scripts and one dev dependency
(`concurrently`). Per-app scripts and internals are in
[`apps/api/README.md`](apps/api/README.md) and
[`apps/web/README.md`](apps/web/README.md).

### If a port is taken

If `3000` or `8080` is busy, copy [`.env.example`](.env.example) to `.env` and
set `API_PORT` or `WEB_PORT`; everything that depends on them follows — the web
app's `API_URL` from `API_PORT`, the API's `CORS_ORIGINS` from `WEB_PORT`. Redis
and MongoDB are unpublished in that stack, so `REDIS_PORT` and `MONGO_PORT` do
nothing there; they belong to the dev overlay below.

Under `npm run dev` the API's port is `PORT` in `apps/api/.env`. That file is not
in the repository: copy [`apps/api/.env.example`](apps/api/.env.example) to
`apps/api/.env` and set `PORT` there. Vite is pinned to 5173 (`strictPort`) — it
refuses to start if the port is taken rather than moving to 5174, which would
leave the dev server on an origin the API's CORS does not allow.

## Local development

Every root script is a thin wrapper around the two apps and Compose:

| Script                                                           | What it runs                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `npm run setup`                                                  | `npm ci` in both apps, in parallel                            |
| `npm run dev`                                                    | `infra:up`, then both apps under `concurrently --kill-others` |
| `npm run dev:api` / `npm run dev:web`                            | one app on its own                                            |
| `npm run infra:up` / `npm run infra:down`                        | Redis and MongoDB only                                        |
| `npm run lint` / `typecheck` / `format:check` / `test` / `build` | fan out to both apps; both always report                      |
| `npm run up` / `down` / `down:clean` / `logs`                    | the full Docker stack                                         |

`infra:up` applies [`docker-compose.dev.yml`](docker-compose.dev.yml), which
publishes Redis on `6379` and MongoDB on `27017` — the addresses
`apps/api/.env.example` already defaults to — on `127.0.0.1` only, since both
run unauthenticated. It also moves the `api` and `web` containers behind a
`containers` profile so they stay out of `up`. `--profile` is a global flag, so
it goes before the subcommand:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  --profile containers up -d          # or: COMPOSE_PROFILES=containers … up -d
```

If `6379` or `27017` is taken, set `REDIS_PORT` or `MONGO_PORT` in `.env`; only
this overlay publishes them. Point the API at the new ports as well — it reads
its own `apps/api/.env`, not the root one, so set `REDIS_URL` and `MONGO_URL`
there to match. Without that the API run from npm keeps dialling `6379` and
`27017` and degrades instead of failing: conversions still answer, but each one
carries a cache warning and `GET /api/v1/history` returns 503.

To point the Vite dev server at a different API, edit
`apps/web/public/config.js`.

## Configuration

### API (`apps/api`)

Every variable is optional. A zod schema
(`apps/api/src/config/env.schema.ts`) applies the defaults below and fails the
process at startup on an invalid value. `apps/api/.env.example` is the same list
in `.env` form.

| Variable                            | Default                                          | What it does                                                                     |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `NODE_ENV`                          | `development`                                    | `development` \| `test` \| `production`; `development` logs pretty, anything else logs JSON |
| `PORT`                              | `3000`                                           | HTTP port                                                                        |
| `LOG_LEVEL`                         | `info`                                           | `fatal`…`trace`, or `silent`                                                     |
| `TRUST_PROXY`                       | `false`                                          | Express `trust proxy`: `false` trusts nobody, `true` every hop, a number `0`–`10` is how many proxies sit in front — it decides whether rate limits and logs see the real client or the load balancer |
| `CORS_ORIGINS`                      | `http://localhost:5173,http://localhost:8080`    | Comma-separated browser origins allowed to call the API                          |
| `REDIS_URL`                         | `redis://localhost:6379`                         | Rates cache and its stale fallback                                               |
| `REDIS_COMMAND_TIMEOUT_MS`          | `300`                                            | Deadline on a single Redis command, so a cache that stops answering degrades the lookup instead of holding it |
| `MONGO_URL`                         | `mongodb://localhost:27017/currency_converter`   | Conversion history                                                               |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | `3000`                                           | How long the driver looks for a server; a bound on time a conversion spends on a database that is down |
| `HISTORY_OPERATION_TIMEOUT_MS`      | `1000`                                           | Deadline on a single history read or write, which server selection alone does not bound |
| `HISTORY_TTL_DAYS`                  | `30`                                             | How long a conversion record is kept, enforced by a TTL index                    |
| `MONOBANK_API_URL`                  | `https://api.monobank.ua/bank/currency`          | Upstream rate source                                                             |
| `MONOBANK_TIMEOUT_MS`               | `5000`                                           | Per-request upstream timeout                                                     |
| `MONOBANK_RETRY_ATTEMPTS`           | `3`                                              | Total attempts including the first; 429 is never retried                         |
| `MONOBANK_RETRY_BASE_DELAY_MS`      | `300`                                            | Base delay for exponential backoff with full jitter                              |
| `MONOBANK_TOTAL_BUDGET_MS`          | `8000`                                           | Ceiling on the whole upstream call including every retry and the backoff between them; past it the stale copy is served instead |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5`                                              | Consecutive upstream failures that trip the breaker open                         |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS`  | `30000`                                          | How long the breaker stays open before one trial call                            |
| `RATES_CACHE_TTL_SECONDS`           | `300`                                            | TTL of the fresh cache key `rates:latest`                                        |
| `RATES_STALE_TTL_SECONDS`           | `86400`                                          | TTL of the long-lived stale fallback key `rates:fallback`                        |
| `THROTTLE_TTL_SECONDS`              | `60`                                             | Rate-limit window                                                                |
| `THROTTLE_LIMIT`                    | `60`                                             | Requests per window per client                                                   |
| `ADMIN_API_KEY`                     | *(unset)*                                        | `x-api-key` for `DELETE /api/v1/rates/cache`. Unset makes `ApiKeyGuard` a no-op, so a local run needs no secret; startup **fails** when it is unset and `NODE_ENV=production`, because an open invalidation route is a lever on an upstream that allows one request a minute |

That is the whole schema: 23 variables, and every one of them is in the table.

### Web (`apps/web`)

| Variable  | Default                 | What it does                                                                  |
| --------- | ----------------------- | ----------------------------------------------------------------------------- |
| `API_URL` | `http://localhost:3000` | Written into `config.js` at container start; the browser reads it, so it must be reachable from the host, not from inside the Compose network |
| `PORT`    | `80`                    | Port nginx listens on (Compose and Railway both set `8080`)                   |

Neither is a build-time variable: the image is built once and the entrypoint
rewrites `config.js` from `API_URL` at container start.

### Compose overrides

[`.env.example`](.env.example) documents the values a developer might want to
change locally: `API_PORT`, `WEB_PORT`, `REDIS_PORT`, `MONGO_PORT`, `LOG_LEVEL`,
`ADMIN_API_KEY`, `RATES_CACHE_TTL_SECONDS`, `RATES_STALE_TTL_SECONDS`. Copy it
to `.env`; Compose picks it up automatically.

## API reference

Base path `/api/v1`; the two health routes are unversioned. The examples below
are real responses, captured from the live deployment except where a
degradation had to be induced locally. Swagger UI is at `/docs` and the OpenAPI
JSON at `/docs-json` — 7 operations, 10 schemas, one `admin` security scheme.

Substitute `http://localhost:3000` for the live host to run these against a
local stack.

### `POST /api/v1/convert`

```bash
curl -sX POST https://api-production-c5b65.up.railway.app/api/v1/convert \
  -H 'content-type: application/json' \
  -d '{"from":"eur","to":"gbp","amount":100}'
```

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

Codes are case-insensitive and echoed upper-cased; `amount` must be a JSON
number, not a string. `strategy` is `identity` | `direct` | `cross`, `source` is
`cache` | `provider` | `stale-cache`. `rate` is rounded half-up to 6 decimals
while `result` is computed from the **unrounded** rate, so on a large amount the
two differ in the last cent — see
[`docs/architecture.md` §5](docs/architecture.md#5-conversion-semantics).

### `GET /api/v1/rates`

```bash
curl -s https://api-production-c5b65.up.railway.app/api/v1/rates
```

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

### `GET /api/v1/currencies`

```bash
curl -s https://api-production-c5b65.up.railway.app/api/v1/currencies
```

```json
{
  "currencies": [
    { "code": "AED", "numericCode": 784, "name": "UAE Dirham" },
    { "code": "AFN", "numericCode": 971, "name": "Afghani" },
    { "code": "ALL", "numericCode": 8, "name": "Lek" }
  ]
}
```

The currencies of the current snapshot plus `UAH`, sorted by code.

### `GET /api/v1/history`

```bash
curl -s 'https://api-production-c5b65.up.railway.app/api/v1/history?limit=2'
```

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

Newest first. `limit` is `1..50`, default `10`, and it is validated rather than
clamped: `?limit=0`, `?limit=51` and `?limit=abc` each answer `400` naming the
field. An entry keeps the provenance the conversion was answered with, so a
rate priced from the stale fallback can be reconciled afterwards.

### `DELETE /api/v1/rates/cache`

```bash
curl -sX DELETE https://api-production-c5b65.up.railway.app/api/v1/rates/cache \
  -H "x-api-key: $ADMIN_API_KEY" -o /dev/null -w '%{http_code}\n'
```

`204` with no body, whether or not the keys were there — the request states the
wanted end state. Without a valid key when `ADMIN_API_KEY` is set:

```json
{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "A valid x-api-key header is required",
  "timestamp": "2026-09-08T18:06:13.322Z",
  "path": "/api/v1/rates/cache",
  "requestId": "b7894223-4082-4de4-b9ba-4dfe6eaba28d"
}
```

A cache that could not be reached answers `503 CACHE_UNAVAILABLE` rather than
`204`: reporting success for keys that are still there would tell an operator
the cache is empty while the stale rates they were clearing keep being served.

### `GET /health` and `GET /health/live`

```bash
curl -s https://api-production-c5b65.up.railway.app/health
curl -s https://api-production-c5b65.up.railway.app/health/live
```

```json
{
  "status": "ok",
  "info": { "redis": { "status": "up" }, "mongodb": { "status": "up" }, "monobank": { "status": "up" } },
  "error": {},
  "details": { "redis": { "status": "up" }, "mongodb": { "status": "up" }, "monobank": { "status": "up" } }
}
```

```json
{ "status": "ok", "info": {}, "error": {}, "details": {} }
```

`/health` is the dependency report and answers `503` the moment an indicator is
down, with the report saying which — with Redis stopped it answers
`{"redis":{"reason":"ping failed","status":"down"}}` beside the two that are up.
`/health/live` has no indicators and answers `200` whenever the process can
serve a request; it is what Railway's `healthcheckPath`, the Dockerfile's
`HEALTHCHECK` and the Compose healthcheck point at, so a degraded dependency
never fails a rollout. The `monobank` indicator reports the circuit-breaker
state rather than calling the upstream, which allows one request a minute.

### Error envelope

Every non-2xx response has one shape:

```bash
curl -sX POST https://api-production-c5b65.up.railway.app/api/v1/convert \
  -H 'content-type: application/json' -d '{"from":"XYZ","to":"USD","amount":10}'
```

```json
{
  "statusCode": 422,
  "code": "UNSUPPORTED_CURRENCY",
  "message": "Currency 'XYZ' is not supported",
  "details": { "currency": "XYZ" },
  "timestamp": "2026-09-08T18:06:13.145Z",
  "path": "/api/v1/convert",
  "requestId": "d4d138fd-acbb-46d8-a2ca-3f5e93c259d0"
}
```

| HTTP | `code`                 | When                                                 |
| ---- | ---------------------- | ---------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | DTO validation failed; `details.errors` lists fields |
| 401  | `UNAUTHORIZED`         | Missing or invalid admin API key                     |
| 403  | `FORBIDDEN`            | The caller may not perform this operation            |
| 404  | `NOT_FOUND`            | Unknown route                                        |
| 422  | `UNSUPPORTED_CURRENCY` | Code is not in the snapshot                          |
| 422  | `RATE_NOT_AVAILABLE`   | No path between the two currencies                   |
| 429  | `TOO_MANY_REQUESTS`    | Throttler limit exceeded                             |
| 503  | `RATES_UNAVAILABLE`    | Upstream failed and no stale copy exists             |
| 503  | `CACHE_UNAVAILABLE`    | The cache could not be reached to invalidate it      |
| 503  | `HISTORY_UNAVAILABLE`  | The conversion history store cannot be read          |
| 500  | `INTERNAL_ERROR`       | Anything unexpected; the message is generic          |

`requestId` is echoed on the `x-request-id` header and tags every log line for
that request. An inbound `x-request-id` is honoured when it is at most 128
characters of `[A-Za-z0-9._-]`.

**Validation errors report one message per field**, not every bound a bad value
also violates:

```bash
curl -sX POST https://api-production-c5b65.up.railway.app/api/v1/convert \
  -H 'content-type: application/json' -d '{"from":"EUR","to":"GB","amount":"100"}'
```

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "errors": [
      { "field": "to", "messages": ["to must match /^[A-Za-z]{3}$/ regular expression"] },
      { "field": "amount", "messages": ["amount must be a number conforming to the specified constraints"] }
    ]
  },
  "timestamp": "2026-09-08T18:06:12.958Z",
  "path": "/api/v1/convert",
  "requestId": "11008b43-9d90-4a41-9ab6-2cdaddb801c7"
}
```

A multi-field body still reports every field; each field reports once.

### Warnings

`POST /convert`, `GET /rates` and `GET /currencies` add a `warnings` array when
something degraded while the request was answered — and **nothing at all** when
nothing did, so a healthy response is byte for byte the one it has always been.
The request succeeded; that is what separates a warning from the envelope above.
Both examples below are real responses from a local stack, the first with the
`mongo` container stopped and the second with `redis` stopped.

`POST /api/v1/convert` while the history store is down — the conversion is still
answered, it just will not be recorded:

```json
{
  "from": "USD",
  "to": "UAH",
  "amount": 100,
  "result": 4435,
  "rate": 44.35,
  "strategy": "direct",
  "source": "cache",
  "ratesTimestamp": "2026-09-08T18:09:18.310Z",
  "warnings": [
    {
      "code": "HISTORY_NOT_RECORDED",
      "message": "The conversion was answered but could not be written to the history store, so it will not appear in /history."
    }
  ]
}
```

`GET /api/v1/rates` while the cache is down — the rates come from the upstream
and nothing was kept for the next request:

```json
{
  "source": "provider",
  "fetchedAt": "2026-09-08T18:09:38.425Z",
  "rates": [{ "base": "USD", "quote": "UAH", "buy": 44.35, "sell": 44.831, "date": "2026-09-08T11:51:13.000Z" }],
  "warnings": [
    {
      "code": "CACHE_UNAVAILABLE",
      "message": "The rates cache could not be reached during this request, so it was not used; `source` says where the rates came from."
    }
  ]
}
```

`GET /api/v1/history` is the one route that changes its answer instead of
warning: with the store down it is `503 HISTORY_UNAVAILABLE` with a
`details.reason` (`"connection not ready"`), never an empty page.

| `code`                 | When                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `CACHE_UNAVAILABLE`    | Redis could not be read or written while the request was answered, so the cache neither served this response nor kept it for the next one. `source` says where the rates did come from |
| `HISTORY_NOT_RECORDED` | `/convert` only: the conversion was answered but its record was dropped or timed out, so it will not appear in `/history` |

## Project layout

```
apps/
├── api/                NestJS 11, TypeScript strict, own package + lockfile
│   ├── src/            config, common (http paths, currency, conversion,
│   │                   warnings, errors, filters, guards, logging, validation,
│   │                   throttling, swagger, resilience, money, utils),
│   │                   infrastructure (redis, mongo), modules (rates,
│   │                   currencies, conversion, history, health)
│   ├── test/e2e/       supertest suites over the real HTTP surface
│   ├── test/integration/  the Redis and Mongo adapters against real servers,
│   │                   skipped unless INTEGRATION_*_URL is set
│   ├── Dockerfile      multi-stage, prod deps only, runs as `node`
│   └── railway.json
└── web/                React 19 + Vite + TypeScript, own package + lockfile
    ├── src/            api (http, repositories, persistence, hooks),
    │                   components, features (converter, about), i18n, lib, test
    ├── nginx/          config template + shared security-headers snippet
    ├── docker/         entrypoint that writes config.js from API_URL
    ├── Dockerfile      node build stage, nginx runtime
    └── railway.json
docs/architecture.md    the design contract
docs/openapi.json       the published API contract, generated (`openapi:write`)
fixtures/               the rates snapshot and golden conversions both suites price against
scripts/check-fixtures.mjs  validates them; `npm run check:fixtures`
package.json            root scripts + `concurrently`; not a workspace
docker-compose.yml      api, web, redis, mongo
docker-compose.dev.yml  overlay: backing services only, published on loopback
.github/workflows/ci.yml
```

## Testing

Four suites, all green on this commit:

| Suite           | Command                                  | Result                    | Coverage                                                                 | Gate                       |
| --------------- | ---------------------------------------- | ------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| API unit        | `apps/api: npm run test:cov`             | 65 suites, **661** tests  | stmts 98.13% · branches 88.78% · funcs 98.40% · lines 98.02%              | 85% lines + branches       |
| API e2e         | `apps/api: npm run test:e2e`             | 8 suites, **124** tests   | not instrumented — see below                                             | none                       |
| API integration | `apps/api: npm run test:integration`     | 2 suites, **12** tests    | not instrumented; skipped unless the two `INTEGRATION_*_URL` are set     | none                       |
| Web             | `apps/web: npm run test:coverage`        | 27 files, **233** tests   | stmts 99.16% (595/600) · branches 96.64% (432/447) · funcs 100% (190/190) · lines 99.14% | 90% on all four            |

**1030 tests, 0 failures.** From the root, `npm test`, `npm run lint`,
`npm run typecheck`, `npm run format:check` and `npm run build` run the same
checks across both apps and let both report, so a failure in one does not hide
the other. Coverage gates and the e2e suite stay per-app.

**How e2e coverage relates to the unit report.** The API coverage numbers above
are the **unit** suites alone, and the 85% gate is on those. `npm run test:e2e`
runs uninstrumented, so what only it exercises is missing from the report rather
than uncovered: `configure-http.ts` and `setup-swagger.ts` read 0% while every
e2e suite boots through both, which is what drags the `src` root row to 52.38%
and `src/common/swagger` to 71.42%. `main.ts` and every `*.module.ts` are
excluded outright — a module is wiring, and what a module *decides* lives in a
file of its own beside it so the gate does see it. Read the two as what they
are: the unit suites cover the logic, the e2e suites cover the surface, and only
the first is counted.

Unit tests never touch the network, Redis or Mongo. The e2e suites do not
either: the shared factory swaps the Redis client, the Mongo connection and the
history repository for in-process fakes, and the environment points every URL at
a dead host, so a suite that forgets an override fails instead of passing
against whatever happens to be running.

**The integration suite is the deliberate exception**, and the reason it exists:
every other test of the Redis and Mongo adapters runs against a hand-written
fake, which can only confirm the assumption its author had about the driver.
`npm run test:integration` runs the same two adapters against real servers — the
TTLs both cache keys are actually written with, the index Mongo actually holds,
the order the page actually comes back in. It runs only when
`INTEGRATION_REDIS_URL` and `INTEGRATION_MONGO_URL` point at one, and otherwise
reports each suite as skipped with the variable that would have run it in the
title, so the gap is visible rather than silent:

```bash
npm run infra:up                      # redis + mongo on the loopback
INTEGRATION_REDIS_URL=redis://127.0.0.1:6379 \
INTEGRATION_MONGO_URL=mongodb://127.0.0.1:27017/currency_converter_integration \
  npm --prefix apps/api run test:integration
```

**Two implementations of §5, one set of numbers.** The browser's offline
estimate re-prices a conversion with the same rules the API applies, and each
side used to carry its own copy of the rates table — which had drifted on two of
the five pairs. Both now read `fixtures/rates-snapshot.json` and assert every
row of `fixtures/golden-conversions.json`, twelve vectors computed once by hand
from the §5 rules. `npm run check:fixtures` validates both files and
cross-references every vector's currencies against the snapshot.

CI runs three jobs on every pull request. `api` and `web` each do lint, format
check, typecheck, build, unit tests with coverage, `npm audit` and a
`docker build` of the image; the API job also runs the e2e suite, which includes
the check that `docs/openapi.json` still matches what the decorators generate.
`orchestration` validates what belongs to neither app — the shared fixtures, the
root lockfile, both Compose files (`config -q` on the base and on the base plus
overlay), both `railway.json` files — then boots the whole stack with the dev
overlay layered on (so Redis and Mongo publish on the loopback), probes
`/health/live` and `/health`, and runs the integration suite against the
services it just started.

## Deployment

Hosted on [Railway](https://railway.com) in project `currency-converter`: two
services built from these Dockerfiles (`api`, `web`) plus managed `Redis` and
`MongoDB`. `railway.json` in each app sets the builder, the health check and the
restart policy.

The deploy gate is **`/health/live`**, not `/health`: a deploy that never becomes
live is never promoted and the previous one keeps serving, while Redis or Mongo
being down degrades the API without stopping it converting and so must not fail
a rollout.

There is deliberately no gateway in front of the two: Railway's edge exposes
each service on its own domain, the API's `CORS_ORIGINS` is restricted to the
web origin, and nginx in the web image exists only to serve the built SPA.

```bash
railway link -p currency-converter   # once per clone; `up` also takes -p <project-id>
railway up apps/api --path-as-root -s api --ci
railway up apps/web --path-as-root -s web --ci
```

Service variables:

| Service | Variable        | Value                                                                    |
| ------- | --------------- | ------------------------------------------------------------------------ |
| `api`   | `NODE_ENV`      | `production`                                                             |
| `api`   | `PORT`          | `3000`                                                                   |
| `api`   | `TRUST_PROXY`   | `1` — one proxy in front, so rate-limit buckets and logs key on the real client |
| `api`   | `ADMIN_API_KEY` | required here: the schema refuses to start in production without one     |
| `api`   | `REDIS_URL`     | `${{Redis.REDIS_URL}}?family=0`                                          |
| `api`   | `MONGO_URL`     | `${{MongoDB.MONGO_URL}}/currency_converter?authSource=admin`             |
| `api`   | `CORS_ORIGINS`  | the web service's public URL, plus the local origins                     |
| `web`   | `PORT`          | `8080`                                                                   |
| `web`   | `API_URL`       | the api service's **public** URL — the browser fetches it, so the private domain would not resolve |

`?family=0` on `REDIS_URL` is not decoration: Railway's private network is
IPv6-only, and ioredis otherwise resolves `redis.railway.internal` as IPv4 and
fails to connect. `family=0` lets it use whichever the DNS answer provides.

`MONGO_URL` is the plugin's own variable with two things appended: the database
name, which the reference does not carry, and `authSource=admin`, because the
root user the plugin creates is defined in the `admin` database and
authenticating against `currency_converter` would fail.

## Requirements traceability

One row per atom of the original task. Evidence is a path in this repository, a
test name, or a live URL; every row was re-verified against this commit.

**Status: 30 of 30 atoms met, 0 partial, 0 not met.**

### 1. Node.js backend with NestJS/TypeScript and design patterns

| #      | Requirement                | Status | Evidence                                                                                                                                                                                                                              |
| ------ | -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a     | Node.js backend exposing a conversion endpoint | met | `apps/api/src/main.ts`, `apps/api/src/modules/conversion/conversion.controller.ts`. Node 24 pinned (`.nvmrc`, `engines.node>=24`). Live: `POST /api/v1/convert` → `200`                                                       |
| 1b     | NestJS and TypeScript      | met    | `apps/api/package.json` (`@nestjs/*` 11), `apps/api/tsconfig.json` strict; `npm run typecheck` exits 0 with `typescript-eslint` `no-unsafe-*` on and `--max-warnings 0`                                                                  |
| 1c-i   | Repository pattern         | met    | Ports `modules/rates/domain/ports.ts` (`RatesRepository`), `modules/history/domain/history-repository.port.ts`; adapters `modules/rates/infrastructure/redis-rates.repository.ts`, `modules/history/infrastructure/mongo-history.repository.ts`. Bound by token; no service imports an adapter |
| 1c-ii  | Dependency injection       | met    | Tokens `RATES_PROVIDER`, `RATES_REPOSITORY`, `HISTORY_REPOSITORY`, `CONVERSION_STRATEGIES`, `HEALTH_INDICATORS`, `MONOBANK_CIRCUIT_BREAKER`, `REDIS_CLIENT`, each declared in the file that declares the contract it injects. Every unit spec substitutes a fake through the same token the runtime uses |
| 1c-iii | Strategy pattern           | met    | `modules/conversion/strategies/` — `conversion-strategy.ts`, `identity`, `direct-pair`, `cross-rate`, `conversion-strategy.resolver.ts`; order declared in `conversion.module.ts`. Tests: “takes the first strategy that prices the pair”, “falls through the ones that decline”, “fails when no registered strategy prices the pair”, “resolves the chain in the order §5 gives it” |

### 2. POST conversion route

| #  | Requirement                        | Status | Evidence                                                                                                                        |
| -- | ---------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 2a | POST route                         | met    | `conversion.controller.ts` `@Post()` + `@HttpCode(200)`, prefix from `common/http/paths.ts`. Test: “answers 200, not 201, with exactly the fields §3 lists” |
| 2b | Accepts source, target, amount     | met    | `modules/conversion/dto/convert-request.dto.ts`. Tests: “takes a well formed body as it was sent”, “normalises the codes to upper case”, “reports every missing field at once”, “rejects a property the request has no business sending” |

### 3. Data fetching from Monobank

| #  | Requirement                    | Status | Evidence                                                                                                                                        |
| -- | ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3a | Latest rates from Monobank     | met    | `config/env.schema.ts` (`MONOBANK_API_URL`), `modules/rates/infrastructure/monobank/` (provider, zod schema, mapper). Test: “requests the configured url and maps the payload into a snapshot”. Live: `GET /api/v1/rates` returns real pairs |
| 3b | Error handling for API requests | met   | `application/describe-rates-failure.ts`, `rates.service.ts` `serveStale`, `RatesUnavailableError`. Tests: “never leaks the upstream failure into the envelope”, “never names the upstream in the envelope it answers with” |
| 3c | Retry mechanism                | met    | `common/resilience/retry.ts` (exponential backoff, full jitter), `should-retry-monobank.ts`. Tests: “doubles the jitter window on every attempt”, “caps the window at maxDelayMs”, “never retries a 429, because the upstream allows one request a minute”. Bounded by `MONOBANK_TOTAL_BUDGET_MS` via `common/utils/with-timeout.ts` |
| 3d | Circuit breaker                | met    | `common/resilience/circuit-breaker.ts` (CLOSED/OPEN/HALF_OPEN), wired in `monobank.module.ts`. Tests: “rejects a second caller while the trial is in flight”, “reopens on a failed trial and starts the window again”, “counts one breaker failure per exhausted call, not one per attempt”. Live: `/health` reports the breaker state |

### 4. Caching layer

| #  | Requirement                     | Status | Evidence                                                                                                                             |
| -- | ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 4a | Cache rates for a set duration  | met    | `redis-rates.repository.ts` `save()` writes `rates:latest` with `EX RATES_CACHE_TTL_SECONDS`. Tests: “writes both keys with the configured expiries”, “answers the second call from the cache without calling out again”, and against a real Redis “writes both keys in one transaction with the configured expiries” (`test/integration/`) |
| 4b | Use Redis                       | met    | `infrastructure/redis/create-redis-client.ts` (ioredis), `redis.module.ts`, `redis-connection.ts`; `docker-compose.yml` `redis:7.4-alpine`; managed Redis on Railway. Live: `/health` → `"redis":{"status":"up"}` |
| 4c | Configurable expiry             | met    | `RATES_CACHE_TTL_SECONDS` (300) and `RATES_STALE_TTL_SECONDS` (86400) in `env.schema.ts`, both in the table above and in `.env.example` |
| 4d | Cache-aside pattern             | met    | `rates.service.ts` `getSnapshot()`: `getFresh()` → miss → `fetchRates()` → `save()`. Tests: “answers from the cache without reaching the upstream”, “fetches, caches and reports the provider as the source”, “serves concurrent callers from one upstream call” (single-flight) |
| 4e | Cache invalidation strategies   | met    | TTL expiry plus `DELETE /api/v1/rates/cache` (`rates.controller.ts`, `redis-rates.repository.ts` `clear`), guarded by `common/guards/api-key.guard.ts`. Tests: “empties the cache so the next read reaches the upstream again”, “refuses a request that carries no key”, “refuses to report an invalidation it could not perform”. Live: without a key → `401 UNAUTHORIZED` |

### 5. Conversion logic

| #  | Requirement                        | Status | Evidence                                                                                                                    |
| -- | ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 5a | Use the fetched rates              | met    | `conversion.service.ts` reads one snapshot via `RatesService`, so two legs cannot straddle a cache expiry. Test: “prices the whole conversion from one snapshot”. The response carries `source` and `ratesTimestamp` |
| 5b | Convert source → target            | met    | `conversion.service.ts` + `common/money/money.ts` (`big.js`, DP 30) + `round-half-up.ts`. Tests: “rounds the money half-up to two decimals”, “computes the result from the unrounded rate”, “rounds a tie up rather than to the nearest float”. No float arithmetic on money |
| 5c | Cross-currency conversion via UAH  | met    | `strategies/cross-rate.strategy.ts` + `directional-rate.ts`, hub `BASE_CURRENCY` in `domain/exchange-rate.ts`. Tests: “composes the leg into the base currency with the leg out of it”, “is not the reciprocal of itself across a spread”, “crosses two currencies that only share the hryvnia”, “takes the published pair over the path through the hryvnia”. Live: EUR→GBP → `"strategy":"cross"` |

### 6. Error handling

| #  | Requirement                          | Status | Evidence                                                                                                                          |
| -- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 6a | Graceful, informative responses      | met    | One envelope in `common/filters/error-response.dto.ts`. Tests: “answers with the documented error envelope”, “reports the same request id in the envelope and the header” |
| 6b | Global exception filters             | met    | `common/filters/global-exception.filter.ts` (`@Catch()`, `APP_FILTER`) and `modules/health/health-exception.filter.ts`. Test: “does not leak the message of a 5xx HttpException” |
| 6c | Meaningful message — invalid request | met    | `common/validation/` (`validation-exception-factory.ts`, which flattens the nested errors, and `validation-pipe.options.ts` with `whitelist`, `forbidNonWhitelisted`, no implicit conversion). Tests: “rejects an amount sent as a string”, “reports a code of the wrong length once”. Live: one message per field |
| 6d | Meaningful message — conversion      | met    | `UnsupportedCurrencyError` (422) and `RateNotAvailableError` (422), split in `conversion-strategy.resolver.ts`. Tests: “reports a code the snapshot never mentions as unsupported”, “reports two quoted currencies with no path between them”. Live: `422 UNSUPPORTED_CURRENCY` with `details.currency` |
| 6e | Meaningful message — API unavailable | met    | `RatesUnavailableError` (`503 RATES_UNAVAILABLE`) from `rates.service.ts`, `HistoryUnavailableError` (`503 HISTORY_UNAVAILABLE`). Tests: “answers 503 in the documented envelope with nothing cached”, “answers 503 with its own code rather than a 500”, “falls back to the stale copy once the fresh key has expired” |
| 6f | Meaningful message — cache failure   | met    | Two answers for two situations. On a read path the request still succeeds and carries a `CACHE_UNAVAILABLE` warning (`common/warnings/collect-warnings.ts`, `RatesLookup.cacheDegraded`); on `DELETE /rates/cache` it answers `503 CACHE_UNAVAILABLE`. Tests: “prices the conversion from the upstream and warns”, “answers the snapshot from the upstream and warns”, “lists the currencies and warns on the same terms”, “refuses to report an invalidation it could not perform”. Also `/health` → `redis: down` with a sanitised reason |

### 7. Docker

| #  | Requirement                            | Status | Evidence                                                                                                                     |
| -- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 7a | Compose with the Node app and Redis    | met    | `docker-compose.yml` — `api`, `web`, `redis:7.4-alpine`, `mongo:7.0`, healthchecks on all four, named volumes, `api` waiting on `service_healthy`. `docker compose config -q` exits 0; CI's `orchestration` job runs `docker compose up --build -d --wait` and probes `/health/live` and `/health` |
| 7b | Easy local development setup           | met    | Root scripts (`setup`, `dev`, `infra:up/down`, `up/down/logs`) and `docker-compose.dev.yml` (backing services on loopback, apps behind a `containers` profile). Two documented paths, both in **Quick start** above |

### 8. Documentation

| #  | Requirement                              | Status | Evidence                                                                                                                    |
| -- | ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 8a | Comprehensive README with start instructions | met | This file: quick start in three forms, every root script, the full configuration table, the API reference above, real test numbers, the Railway deploy. Per-app READMEs add scripts and internals |
| 8b | API documentation                        | met    | Swagger UI at `/docs`, OpenAPI at `/docs-json` (7 operations, 10 schemas, an `admin` scheme) generated from the code and committed as `docs/openapi.json`; `docs/architecture.md` §3 is the written contract. `test/e2e/swagger.e2e-spec.ts` keeps them in step — “documents no route that the API does not serve” — and `openapi-contract.e2e-spec.ts` fails when the committed document drifts from the decorators (`npm run openapi:write` regenerates it) |
| 8c | Environment configuration                | met    | `apps/api/src/config/env.schema.ts` (zod, fails fast), `apps/api/.env.example` and root `.env.example`; the configuration table above lists all 23 variables |

### Beyond the task

The brief for this build asked for more than the eight sections. Each of these
is implemented and covered:

| Requirement | Where |
| ----------- | ----- |
| Production readiness | helmet, CORS allowlist, `trust proxy`, `@nestjs/throttler`, graceful shutdown, non-root multi-stage image, `ADMIN_API_KEY` required in production. `test/e2e/http-hardening.e2e-spec.ts`, `test/e2e/throttling.e2e-spec.ts` |
| Structured logging | `common/logging/` — nestjs-pino, `request-id.ts` (header, sanitiser, assigner, middleware), `serializers.ts`, level resolver, once-per-outage reporter. Credentials and connection strings never reach a client or a log line |
| React frontend | `apps/web/` — React 19 + Vite + TanStack Query + React Router, converter and `/about` pages |
| MongoDB history | `infrastructure/mongo/`, `modules/history/`, TTL index from `HISTORY_TTL_DAYS`, `GET /api/v1/history` |
| Repository pattern on the web | `apps/web/src/api/repositories/` — five interfaces in `repositories.ts`, their HTTP implementations in `createHttpRepositories.ts`, `RepositoriesProvider` / `useRepositories`; tests inject fakes through the same provider |
| Offline fallback | `features/converter/lib/convertOffline.ts` + `api/persistence/` — a persisted snapshot re-priced in the browser, labelled `offline-estimate` and never written to history. Priced against the same `fixtures/golden-conversions.json` the API's e2e suite asserts |
| Container-backed integration tests | `apps/api/test/integration/` — the Redis and Mongo adapters against real servers, run by CI's `orchestration` job against the stack it starts |
| Client/contract check | `docs/openapi.json` committed and regenerated by an e2e test; the web suite validates every sample response it renders against those schemas with `ajv` |
| i18n-ready strings | `apps/web/src/i18n/` — every string in `en.json`, keys type-checked; `messageKeys.test.ts` proves every envelope and warning code has a sentence |
| Strict typing | `tsc --noEmit` / `tsc -b` clean, `no-unsafe-*` on, `ConfigService<AppConfig, true>` so an unknown config key is a compile error |
| Multi-commit history through PRs | Conventional-commit subjects, a branch per feature, and every change merged into `main` through a reviewed pull request with CI green |
| Railway hosting | `apps/api/railway.json`, `apps/web/railway.json`, both services live at the URLs above |
| Reviewer page | `/about` in the web app — status, traceability, how to run, decisions, live health check |

## Design decisions

Each links to the section of [`docs/architecture.md`](docs/architecture.md) that
argues it.

- **Ports and adapters, both sides** — domain code depends on interfaces; Monobank, Redis and Mongo are adapters behind DI tokens, and the web app mirrors the shape. [§2](docs/architecture.md#2-design-principles), [§10](docs/architecture.md#10-web-app)
- **Strategy chain for pricing** — identity, direct pair and cross via UAH, ordered as data in the module rather than branched in a resolver. [§5](docs/architecture.md#5-conversion-semantics)
- **Cache-aside with single-flight** — a fresh key and a long-lived fallback key, concurrent misses sharing one upstream call. [§4](docs/architecture.md#4-rates-domain)
- **Retry, breaker and budgets** — jittered exponential backoff inside a hand-written circuit breaker, with a ceiling on the whole call; 429 is never retried. [§6](docs/architecture.md#6-resilience-appsapisrccommonresilience)
- **Warnings on a successful answer** — what degraded is reported beside the result, absent rather than empty when nothing did. [§3](docs/architecture.md#3-api-contract)
- **Graceful degradation** — Redis or Mongo being down costs a feature, not the request. [§2](docs/architecture.md#2-design-principles)
- **Liveness and readiness split** — `/health/live` gates deploys, `/health` reports dependencies and is free to answer 503. [§3](docs/architecture.md#3-api-contract)
- **No gateway** — the platform edge publishes each service; CORS is the check a gateway would have been added to perform. [§10](docs/architecture.md#10-web-app)
- **Two-layer fallback** — the API survives Monobank with a stale Redis copy, the browser survives the API with a persisted one. [§10](docs/architecture.md#10-web-app)
- **Internationalisation** — every user-visible string in a dictionary, keys type-checked against it. [§12](docs/architecture.md#12-conventions)
- **Repository layer on the web** — one interface per resource behind a provider, so a component test never touches the transport. [§10](docs/architecture.md#10-web-app)

Known limitations and follow-ups are listed honestly in
[`docs/architecture.md` §14](docs/architecture.md#14-known-limitations-and-follow-ups).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — the design contract: module
  layout, API contract, caching and resilience, error envelope, configuration,
  testing strategy, requirements mapping, known limitations.
- [Swagger UI](https://api-production-c5b65.up.railway.app/docs) — generated
  from the code; OpenAPI JSON at
  [`/docs-json`](https://api-production-c5b65.up.railway.app/docs-json).
- [`/about`](https://web-production-36ebc.up.railway.app/about) — a page in the
  app itself describing what was built and why, with a live health check.
- [`apps/api/README.md`](apps/api/README.md) and
  [`apps/web/README.md`](apps/web/README.md) — per-app scripts and internals.

## License

MIT — see [`LICENSE`](LICENSE).
