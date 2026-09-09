# currency-converter-api

NestJS REST API for the currency converter. See
[`docs/architecture.md`](../../docs/architecture.md) for the design contract.

This package is self-contained: it has its own `package.json` and lockfile and
is built and deployed on its own, without a root workspace.

## Requirements

Node 24 (see `.nvmrc`). Redis backs the rates cache and MongoDB stores the
conversion history and the daily rate archive; the API starts and serves without
either. Without Redis the cache reports down on `/health` and every request pays
an upstream call; without Mongo conversions are answered but not recorded and
days are not archived, and `/history` and `/rates/history` answer `503`.

## Getting started

```bash
npm ci
cp .env.example .env   # optional, every variable has a default
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- Health: `http://localhost:3000/health` (liveness: `/health/live`)

## Endpoints

| Method | Path | What it does |
| ------ | ---- | ------------ |
| `POST` | `/api/v1/convert` | Converts an amount between two currencies and reports the rate, the strategy that priced it and how old the rates were |
| `GET` | `/api/v1/rates` | The current exchange rate snapshot, with the `source` it was served from: `cache`, `provider`, `stale-cache` or `archive` |
| `GET` | `/api/v1/rates/history` | The archived daily rates for one published pair, oldest first. `?base=` and `?quote=` are required; `?days=` is `1..90`, default `7` |
| `DELETE` | `/api/v1/rates/cache` | Drops both cache keys so the next read refetches. `204`, or `503 CACHE_UNAVAILABLE` when Redis could not be reached; needs `x-api-key` when `ADMIN_API_KEY` is set |
| `GET` | `/api/v1/currencies` | The currencies of the current snapshot, with ISO 4217 names and numeric codes, sorted by code |
| `GET` | `/api/v1/history` | The most recent conversions, newest first. `?limit=` is `1..50`, default `10` |
| `GET` | `/health` | Terminus report with the `redis`, `mongodb` and `monobank` indicators. `503` when any of them is down |
| `GET` | `/health/live` | Liveness: `200` whenever the process is up, whatever its dependencies are doing |

`source` is worth reading: `stale-cache` is a `200` served from the fallback key
because the upstream could not be reached, so the rates are older than the cache
TTL, and `archive` is a `200` served from the newest day the Mongo archive holds
because the fallback key had expired too — days old rather than hours. When the
upstream fails and neither has a copy, `/rates` and `/currencies` answer
`503 RATES_UNAVAILABLE`. Redis being down is not a failure at all: the
rates come from the upstream and the answer carries a `CACHE_UNAVAILABLE`
warning saying the cache was not part of it (see **Warnings** below).

Monobank allows one request per minute. A cache miss is de-duplicated, so a
burst of concurrent callers produces one upstream call rather than one each, and
`DELETE /rates/cache` is the only way to force a refetch before the TTL expires.

## Converting

```bash
curl -sX POST http://localhost:3000/api/v1/convert \
  -H 'content-type: application/json' \
  -d '{"from":"EUR","to":"GBP","amount":100}'
```

```json
{
  "from": "EUR",
  "to": "GBP",
  "amount": 100,
  "result": 85.09,
  "rate": 0.850942,
  "strategy": "cross",
  "source": "cache",
  "ratesTimestamp": "2026-09-08T12:00:00.000Z"
}
```

Codes are case-insensitive and echoed upper-cased. `amount` has to be a JSON
number: the API does not coerce, so `"100"` is a `400` naming the field rather
than a value quietly reinterpreted.

`strategy` says how the rate was arrived at — `direct` is a pair Monobank
publishes, `cross` composes two of them through the hryvnia and so pays a
spread twice, `identity` is a currency converted to itself. `rate` is rounded
to six decimals for display, while `result` is computed from the unrounded
rate, so on a large amount it will not always match `amount × rate` to the
last cent.

An amount worth less than half a cent of the target answers `200` with
`result: 0` — `0.01 UAH → USD` is 0.000223 dollars — and `rate` is what explains
the zero.

A pair the current snapshot cannot price answers `422`: `UNSUPPORTED_CURRENCY`
when a code is not in the snapshot at all, `RATE_NOT_AVAILABLE` when both codes
are quoted and there is no path between them.

### Warnings

`/convert`, `/rates` and `/currencies` add a `warnings` array when something
degraded while the request was answered — and nothing at all when it did not, so a healthy
response is exactly the one above:

```json
{
  "result": 4435,
  "source": "provider",
  "warnings": [
    {
      "code": "CACHE_UNAVAILABLE",
      "message": "The rates cache could not be reached during this request, so it was not used; `source` says where the rates came from."
    }
  ]
}
```

| `code` | What it means |
| ------ | ------------- |
| `CACHE_UNAVAILABLE` | Redis could not be read or written while the request was answered, so the cache neither served this response nor kept it for the next one. `source` says where the rates did come from |
| `HISTORY_NOT_RECORDED` | `/convert` only: the conversion was answered but not stored, so it will not appear in `/history` |
| `ARCHIVE_NOT_RECORDED` | The snapshot behind this answer was fetched but not archived, so that day is missing from `/rates/history` and cannot back a later fallback |

The request succeeded either way — a warning is not an error, and the answer is
the answer. `message` is safe to show to a user; a client switches on `code`.

## History

Every conversion is recorded on its way out and read back newest first:

```bash
curl -s 'http://localhost:3000/api/v1/history?limit=2'
```

```json
{
  "items": [
    {
      "id": "6f0000000000000000000001",
      "from": "EUR",
      "to": "GBP",
      "amount": 100,
      "result": 85.09,
      "rate": 0.850942,
      "strategy": "cross",
      "source": "cache",
      "ratesTimestamp": "2026-09-08T12:00:00.000Z",
      "createdAt": "2026-09-08T12:00:05.000Z"
    }
  ]
}
```

An entry keeps the provenance the conversion was answered with, so a rate that
does not match the ones published around it is explained by its `source` rather
than by guesswork. Records expire after `HISTORY_TTL_DAYS` (30 by default),
enforced by a TTL index on the collection.

The write never delays or fails a conversion. When Mongo is not connected the
record is skipped and the response is returned as usual, with one warning per
outage rather than one per request; `GET /history` is the only route that then
changes its answer, to `503 HISTORY_UNAVAILABLE`. `?limit=0`, `?limit=51` and
`?limit=abc` answer `400` naming the field — the API validates the page size
rather than clamping it.

## Rate history

Every successful upstream fetch is archived into `rate_snapshots`, keyed by the
UTC day, so the collection holds at most one document per day — always that
day's latest snapshot. Two things read it: the fourth fallback tier above, and
this route.

```bash
curl -s 'http://localhost:3000/api/v1/rates/history?base=USD&quote=UAH&days=7'
```

```json
{
  "base": "USD",
  "quote": "UAH",
  "days": 7,
  "points": [
    { "date": "2026-09-08", "buy": 44.15, "sell": 44.6512 },
    { "date": "2026-09-09", "buy": 44.35, "sell": 44.831 }
  ]
}
```

Oldest first, one point per archived day inside the window, counting today as
the first. A day the archive has no snapshot for is absent rather than null, so
a gap is visible as a gap and the series can be shorter than `days`. Days expire
after `RATES_ARCHIVE_TTL_DAYS` (90 by default), enforced by a TTL index — which
is also why `days` stops at 90.

The orientation is the upstream's own: `USD/UAH` is a pair Monobank publishes
and `UAH/USD` is not, and this route reports what was published rather than what
could be derived from it. A code the window never quoted answers
`422 UNSUPPORTED_CURRENCY`; two archived codes with no published pair between
them — a reversed orientation included — answer `422 RATE_NOT_AVAILABLE`.
`?days=0`, `?days=91` and `?days=abc` answer `400` naming the field, and a
Mongo that cannot be read answers `503 ARCHIVE_UNAVAILABLE` rather than an empty
series.

## Configuration

Every variable is optional and validated by a zod schema at startup; an invalid
value fails the process immediately with a list of what is wrong. `.env.example`
documents each one with its default.

Reads go through `ConfigService<AppConfig, true>` (aliased as
`TypedConfigService`), so a key that is not in the schema is a compile error and
a validated value is never typed as possibly undefined.

Behind a proxy set `TRUST_PROXY` to the number of hops in front of the process
(`1` on Railway or behind a single nginx). Without it every client shares the
proxy's address, which means one rate-limit bucket for all of them and a request
log that names the load balancer.

## Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint, fails on any warning |
| `npm run format` | Prettier over `src` and `test`, rewriting files |
| `npm run format:check` | The same check without rewriting, as CI runs it |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run test:cov` | Unit tests with the 85% line and branch gate |
| `npm run test:e2e` | End-to-end tests over the real HTTP surface |
| `npm run test:integration` | The Redis and the two Mongo adapters against real servers; skipped with a `SKIPPED:` line unless `INTEGRATION_REDIS_URL` / `INTEGRATION_MONGO_URL` are set, and an error rather than a skip under `CI` |
| `npm run openapi:write` | Regenerates `docs/openapi.json` from the decorators |

Unit tests live in a `__tests__` folder beside the code they cover; the
end-to-end suites live in `test/e2e` and boot the app the way `main.ts` does.

`test/integration` is the only place anything reaches a real Redis or MongoDB.
Every other test of those three adapters runs against a hand-written fake, which
can only confirm the assumption its author had about the driver; these check the
TTLs both cache keys are actually written with, the indexes Mongo actually
holds, the order a page actually comes back in, and that a second fetch of a day
replaces that day's archived document rather than adding one. They write the
application's own key names, so the Redis suite works on database 15 and empties
only that one, and each Mongo suite runs on a database of its own.
Point them at a running pair:

```bash
npm run infra:up   # from the repository root
INTEGRATION_REDIS_URL=redis://127.0.0.1:6379 \
INTEGRATION_MONGO_URL=mongodb://127.0.0.1:27017/currency_converter_integration \
  npm run test:integration
```

`docs/openapi.json` at the repository root is the published contract, committed
so a change to it shows up in a diff. `test/e2e/openapi-contract.e2e-spec.ts`
regenerates it from the application's own decorators and fails when the two
differ, naming `openapi:write` as the fix; the web app validates its own
response fixtures against those schemas.

The coverage report is the **unit** suites only, and the 85% gate is on those
numbers. `npm run test:e2e` runs without instrumentation, so what only it
exercises is missing from the report rather than uncovered: `configure-http.ts`
and `setup-swagger.util.ts` read 0% while every e2e suite boots through both, and
`main.ts` and the `*.module.ts` files are excluded outright — a module is
wiring, and what a module decides lives in a file of its own beside it so that
the gate does see it. Read the two numbers as what they are: the unit suites
cover the logic, the e2e suites cover the surface, and only the first is
counted.

## Layout and naming

`src/config`, `src/common`, `src/infrastructure` and `src/modules`, one folder
per feature module (`rates`, `conversion`, `currencies`, `history`, `health`)
and one per shared package under `common/`. Each of those folders publishes an
`index.ts` and that index is the only way in from outside it: `conversion`
imports `../rates`, never `../rates/domain/exchange-rate.types`.
`no-restricted-imports` in `eslint.config.mjs` fails the build on an import
that reaches inside another module or `common/` package, with a second clause
keeping `common/` free of any import from `modules/`. Inside a folder the
imports stay direct.

Every file carries a suffix naming its role — `.controller.ts`, `.service.ts`,
`.provider.ts`, `.repository.ts`, `.indicator.ts`, `.strategy.ts`,
`.resolver.ts`, `.mapper.ts`, `.factory.ts`, `.interface.ts` (a port and its DI
token), `.enum.ts`, `.types.ts`, `.constants.ts`, `.util.ts`, `.options.ts`,
`.schema.ts`, `.dto.ts`, `.filter.ts`, `.guard.ts`, `.decorator.ts`,
`.error.ts`, `.module.ts`, `.spec.ts`. The full table, with what each one
means, is in [§12 of the architecture](../../docs/architecture.md#12-conventions);
only `main.ts`, `configure-http.ts` and the `index.ts` files carry none.

## Errors

Every non-2xx response uses one envelope:

```json
{
  "statusCode": 422,
  "code": "UNSUPPORTED_CURRENCY",
  "message": "Currency 'XYZ' is not supported",
  "details": { "currency": "XYZ" },
  "timestamp": "2026-09-08T12:00:00.000Z",
  "path": "/api/v1/convert",
  "requestId": "..."
}
```

`requestId` is the id from the `x-request-id` header when the caller sends one
that is at most 128 characters of `[A-Za-z0-9._-]`, and a generated UUID
otherwise. It is echoed back on the response and tags every log line for that
request, so a report can be traced to its logs. It is assigned before the body
parser, so even a request whose body cannot be read is traceable.

A 4xx that has no documented code of its own is named after the failure, so a
406 answers `NOT_ACCEPTABLE`; a 5xx always answers `INTERNAL_ERROR` with a
generic message and keeps the detail in the log.

`/health` is the one exception to the envelope: it answers with the Terminus
report so a failing indicator stays visible to monitoring. It carries a limit of
its own — 60 requests a minute, above any poll rate and still a bound on a route
that pings Redis and Mongo for whoever asks; `/health/live` is the exempt one,
so a probe cannot throttle itself into a restart loop.

`/health/live` is the liveness probe, and it is the one Railway's
`healthcheckPath`, the Dockerfile's `HEALTHCHECK` and the Compose healthcheck
point at. `/health` reporting `503` is the right answer for monitoring and the
wrong one for a deploy gate: Redis or Mongo being down degrades this API without
stopping it converting, so neither should fail a rollout or restart a container
that is serving.

## Docker

```bash
docker build -t currency-api:local .
docker run --rm -p 3000:3000 -e ADMIN_API_KEY=local-admin-key currency-api:local
```

The image is multi-stage, installs production dependencies only, and runs as the
unprivileged `node` user. CI builds it on every pull request. It sets
`NODE_ENV=production`, where the schema refuses to start without an
`ADMIN_API_KEY`: an unset key leaves cache invalidation open to anyone who can
reach the deployment.

With a Redis and a Mongo to talk to:

```bash
docker run -d --name cc-redis -p 6379:6379 redis:7-alpine
docker run -d --name cc-mongo -p 27017:27017 mongo:7
docker run --rm -p 3000:3000 \
  -e ADMIN_API_KEY=local-admin-key \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e MONGO_URL=mongodb://host.docker.internal:27017/currency_converter \
  currency-api:local
```

The Redis client connects on module init, so the first cache read of the process
reaches a live Redis. The Mongo connection is opened without being waited for,
so a database that is down delays nothing and the API boots and converts
regardless; both are logged and reported on `/health`.

On Railway the database variable is a reference to the Mongo service, with the
database name and the auth source the plugin's root user needs:

```
MONGO_URL=${{MongoDB.MONGO_URL}}/currency_converter?authSource=admin
```
