# currency-converter-api

NestJS REST API for the currency converter. See
[`docs/architecture.md`](../../docs/architecture.md) for the design contract.

This package is self-contained: it has its own `package.json` and lockfile and
is built and deployed on its own, without a root workspace.

## Requirements

Node 24 (see `.nvmrc`). Redis and MongoDB are only needed once the rates and
history modules land; the API starts and answers `/health` without them.

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

## Configuration

Every variable is optional and validated by a zod schema at startup; an invalid
value fails the process immediately with a list of what is wrong. `.env.example`
documents each one with its default.

Reads go through `ConfigService<AppConfig, true>` (aliased as
`TypedConfigService`), so a key that is not in the schema is a compile error and
a validated value is never typed as possibly undefined.

## Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint, fails on any warning |
| `npm run format` | Prettier over `src` and `test` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run test:cov` | Unit tests with the 85% line and branch gate |
| `npm run test:e2e` | End-to-end tests over the real HTTP surface |

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
and a generated UUID otherwise. It is echoed back on the response and tags every
log line for that request, so a report can be traced to its logs.

`/health` is the one exception: it answers with the Terminus report so a failing
indicator stays visible to monitoring.

## Docker

```bash
docker build -t currency-api:local .
docker run --rm -p 3000:3000 currency-api:local
```

The image is multi-stage, installs production dependencies only, and runs as the
unprivileged `node` user.
