# currency-converter-api

NestJS REST API for the currency converter. See
[`docs/architecture.md`](../../docs/architecture.md) for the design contract.

This package is self-contained: it has its own `package.json` and lockfile and
is built and deployed on its own, without a root workspace.

## Requirements

Node 24 (see `.nvmrc`). Redis backs the rates cache; the API starts and serves
without it, reporting the cache as down on `/health` and paying an upstream call
per request. MongoDB is only needed once the history module lands.

## Getting started

```bash
npm ci
cp .env.example .env   # optional, every variable has a default
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- Health: `http://localhost:3000/health`

## Endpoints

| Method | Path | What it does |
| ------ | ---- | ------------ |
| `GET` | `/api/v1/rates` | The current exchange rate snapshot, with the `source` it was served from: `cache`, `provider` or `stale-cache` |
| `DELETE` | `/api/v1/rates/cache` | Drops both cache keys so the next read refetches. `204`; needs `x-api-key` when `ADMIN_API_KEY` is set |
| `GET` | `/api/v1/currencies` | The currencies of the current snapshot, with ISO 4217 names and numeric codes, sorted by code |
| `GET` | `/health` | Terminus report with the `redis` and `monobank` indicators |

`source` is worth reading: `stale-cache` is a `200` served from the fallback key
because the upstream could not be reached, so the rates are older than the cache
TTL. When the upstream fails and no fallback exists, `/rates` and `/currencies`
answer `503 RATES_UNAVAILABLE`.

Monobank allows one request per minute. A cache miss is de-duplicated, so a
burst of concurrent callers produces one upstream call rather than one each, and
`DELETE /rates/cache` is the only way to force a refetch before the TTL expires.

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

Unit tests live in a `__tests__` folder beside the code they cover; the
end-to-end suites live in `test/e2e` and boot the app the way `main.ts` does.

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
report so a failing indicator stays visible to monitoring, and it is exempt from
the rate limit so a liveness probe cannot throttle itself into a restart loop.

## Docker

```bash
docker build -t currency-api:local .
docker run --rm -p 3000:3000 currency-api:local
```

The image is multi-stage, installs production dependencies only, and runs as the
unprivileged `node` user. CI builds it on every pull request.

With a Redis to talk to:

```bash
docker run -d --name cc-redis -p 6379:6379 redis:7-alpine
docker run --rm -p 3000:3000 -e REDIS_URL=redis://host.docker.internal:6379 currency-api:local
```

The client connects on module init, so the first cache read of the process
reaches a live Redis; a Redis that is down is logged and leaves the API
serving.
