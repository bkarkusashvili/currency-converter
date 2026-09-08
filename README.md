# Currency Converter

[![CI](https://github.com/bkarkusashvili/currency-converter/actions/workflows/ci.yml/badge.svg)](https://github.com/bkarkusashvili/currency-converter/actions/workflows/ci.yml)

A production-shaped currency converter built on the Monobank public
exchange-rate API: a NestJS REST API that caches rates in Redis behind a
circuit breaker and records conversion history in MongoDB, and a React SPA that
talks to it. The point of the repository is the engineering around the feature —
ports and adapters on both sides, one error envelope, resilience against a
flaky upstream, a typed and validated configuration surface, tests with
coverage gates, and a stack that comes up with one command locally and deploys
from the same images.

## Live

| What            | URL                                                       |
| --------------- | --------------------------------------------------------- |
| Web app         | https://web-production-36ebc.up.railway.app               |
| Reviewer page   | https://web-production-36ebc.up.railway.app/about         |
| API docs        | https://api-production-c5b65.up.railway.app/docs          |
| API health      | https://api-production-c5b65.up.railway.app/health        |

## Status

Merged on `main`: the API foundation (config, logging, error envelope, rate
limiting, Redis client, `GET /health`, Swagger at `/docs` and `/docs-json`) and
the web app (converter and `/about` pages, i18n, repository layer, nginx image).
**`/health`, `/docs` and `/docs-json` are the only endpoints the API serves
today.**

In progress:

- **Rates and currencies** — Monobank provider, retry + circuit breaker, Redis
  cache-aside with a stale fallback, `GET /api/v1/rates` and
  `GET /api/v1/currencies`:
  [#3](https://github.com/bkarkusashvili/currency-converter/pull/3).
- **Conversion and history** — `POST /api/v1/convert` and
  `GET /api/v1/history` over MongoDB: next, per
  [`docs/architecture.md`](docs/architecture.md) §3–§5.

The web app already renders against these endpoints, so it shows an error state
until the API side lands.

## Quick start

Requires Docker with Compose v2. Nothing else — no Node install, no local Redis.

```bash
docker compose up --build
```

| What          | URL                          |
| ------------- | ---------------------------- |
| Web           | http://localhost:8080        |
| API base path | http://localhost:3000/api/v1 |
| Swagger       | http://localhost:3000/docs   |
| Health        | http://localhost:3000/health |

Redis and MongoDB run inside the network and are not published. The API waits
for both to report healthy before it starts.

```bash
docker compose down      # stop, keep the Redis and Mongo volumes
docker compose down -v   # stop and wipe the volumes
```

If port 3000 or 8080 is taken on your machine, copy [`.env.example`](.env.example)
to `.env` and set `API_PORT` / `WEB_PORT`. Everything that depends on them —
the web app's `API_URL` and the API's `CORS_ORIGINS` — follows automatically.

A `Makefile` wraps the four commands worth aliasing: `make up`, `make down`,
`make dev`, `make logs`.

## Local development

Run Redis and MongoDB in Docker and the two apps from npm, so both reload on
save:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d   # or: make dev
```

The overlay publishes Redis on `6379` and MongoDB on `27017` — the addresses
`apps/api/.env.example` already defaults to — and moves the `api` and `web`
containers behind a `containers` profile so they stay out of `up`. Add
`--profile containers` to that command to bring them back.

```bash
cd apps/api && npm ci && npm run start:dev   # http://localhost:3000
cd apps/web && npm ci && npm run dev         # http://localhost:5173
```

Node 24 (see [`.nvmrc`](.nvmrc)). Each app is an independent npm package with
its own lockfile; there is no root workspace. Per-app scripts and layout are in
[`apps/api/README.md`](apps/api/README.md) and
[`apps/web/README.md`](apps/web/README.md).

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
| `NODE_ENV`                          | `development`                                    | `development` logs pretty, anything else logs JSON                               |
| `PORT`                              | `3000`                                           | HTTP port                                                                        |
| `LOG_LEVEL`                         | `info`                                           | `fatal`…`trace`, or `silent`                                                     |
| `TRUST_PROXY`                       | `false`                                          | Express `trust proxy`; `1` behind a single proxy, so rate limits and logs see the real client |
| `CORS_ORIGINS`                      | `http://localhost:5173,http://localhost:8080`    | Comma-separated browser origins allowed to call the API                          |
| `REDIS_URL`                         | `redis://localhost:6379`                         | Rates cache and its stale fallback                                               |
| `MONGO_URL`                         | `mongodb://localhost:27017/currency_converter`   | Conversion history                                                               |
| `MONOBANK_API_URL`                  | `https://api.monobank.ua/bank/currency`          | Upstream rate source                                                             |
| `MONOBANK_TIMEOUT_MS`               | `5000`                                           | Per-request upstream timeout                                                     |
| `MONOBANK_RETRY_ATTEMPTS`           | `3`                                              | Total attempts including the first; 429 is never retried                         |
| `MONOBANK_RETRY_BASE_DELAY_MS`      | `300`                                            | Base delay for exponential backoff with full jitter                              |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5`                                              | Consecutive upstream failures that trip the breaker open                         |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS`  | `30000`                                          | How long the breaker stays open before one trial call                            |
| `RATES_CACHE_TTL_SECONDS`           | `300`                                            | TTL of the fresh cache key                                                       |
| `RATES_STALE_TTL_SECONDS`           | `86400`                                          | TTL of the long-lived stale fallback key                                         |
| `THROTTLE_TTL_SECONDS`              | `60`                                             | Rate-limit window                                                                |
| `THROTTLE_LIMIT`                    | `60`                                             | Requests per window per client                                                   |
| `ADMIN_API_KEY`                     | *(unset)*                                        | `x-api-key` for cache invalidation; unset leaves it open                         |

### Web (`apps/web`)

| Variable  | Default                 | What it does                                                                  |
| --------- | ----------------------- | ----------------------------------------------------------------------------- |
| `API_URL` | `http://localhost:3000` | Written into `config.js` at container start; the browser reads it, so it must be reachable from the host, not from inside the network |
| `PORT`    | `80`                    | Port nginx listens on (Compose and Railway both set `8080`)                   |

### Compose overrides

[`.env.example`](.env.example) documents the handful of values a developer might
want to change locally: `API_PORT`, `WEB_PORT`, `REDIS_PORT`, `MONGO_PORT`,
`LOG_LEVEL`, `RATES_CACHE_TTL_SECONDS`, `RATES_STALE_TTL_SECONDS`. Copy it to
`.env`; Compose picks it up automatically.

## Project layout

```
apps/
├── api/                NestJS 11, TypeScript strict, own package + lockfile
│   ├── src/            config, common (logging, filters, throttling, swagger),
│   │                   infrastructure (redis), modules (health)
│   ├── test/e2e/       supertest suites over the real HTTP surface
│   ├── Dockerfile      multi-stage, prod deps only, runs as `node`
│   └── railway.json
└── web/                React 19 + Vite + TypeScript, own package + lockfile
    ├── src/            api (http, repositories, hooks), components, features,
    │                   i18n, lib, test
    ├── nginx/          config template + shared security-headers snippet
    ├── docker/         entrypoint that writes config.js from API_URL
    ├── Dockerfile      node build stage, nginx runtime
    └── railway.json
docs/architecture.md    the design contract
docker-compose.yml      api, web, redis, mongo
docker-compose.dev.yml  overlay: backing services only, ports published
.github/workflows/ci.yml
```

## Testing

CI runs both jobs on every pull request: lint, format check, typecheck, build,
unit tests with coverage, and a `docker build` of each image. The API job also
runs the e2e suite.

```bash
cd apps/api
npm test              # unit tests
npm run test:cov      # with the coverage gate: 85% lines and branches
npm run test:e2e      # boots the app the way main.ts does

cd apps/web
npm test              # unit tests (Vitest + Testing Library)
npm run test:coverage # with the coverage gate: 90% statements/branches/functions/lines
```

Unit tests never touch the network, Redis or Mongo: the API mocks at the port
boundary, the web app injects in-memory repository fakes through the same
provider the real implementations use.

## Deployment

Hosted on [Railway](https://railway.com) in project `currency-converter`: two
services built from these Dockerfiles (`api`, `web`) plus managed `Redis` and
`MongoDB`. `railway.json` in each app sets the builder, the health check and the
restart policy, so a deploy that never becomes healthy is rolled back instead of
going live.

```bash
railway up apps/api --path-as-root -s api --ci
railway up apps/web --path-as-root -s web --ci
```

Service variables:

| Service | Variable        | Value                                                                    |
| ------- | --------------- | ------------------------------------------------------------------------ |
| `api`   | `NODE_ENV`      | `production`                                                             |
| `api`   | `PORT`          | `3000`                                                                   |
| `api`   | `TRUST_PROXY`   | `1` — one proxy in front, so rate-limit buckets and logs key on the real client |
| `api`   | `REDIS_URL`     | `${{Redis.REDIS_URL}}?family=0`                                          |
| `api`   | `CORS_ORIGINS`  | the web service's public URL, plus the local origins                     |
| `web`   | `PORT`          | `8080`                                                                   |
| `web`   | `API_URL`       | the api service's **public** URL — the browser fetches it, so the private domain would not resolve |

`?family=0` on `REDIS_URL` is not decoration: Railway's private network is
IPv6-only, and ioredis otherwise resolves `redis.railway.internal` as IPv4 and
fails to connect. `family=0` lets it use whichever the DNS answer provides.
`MONGO_URL` joins the list with the history module.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — the design contract: module
  layout, API contract, caching and resilience, error envelope, configuration,
  testing strategy.
- [Swagger UI](https://api-production-c5b65.up.railway.app/docs) — generated
  from the code; OpenAPI JSON at
  [`/docs-json`](https://api-production-c5b65.up.railway.app/docs-json).
- [`/about`](https://web-production-36ebc.up.railway.app/about) — a page in the
  app itself describing what was built and why, with a live health check.
- [`apps/api/README.md`](apps/api/README.md) and
  [`apps/web/README.md`](apps/web/README.md) — per-app scripts and internals.

## License

MIT — see [`LICENSE`](LICENSE).
