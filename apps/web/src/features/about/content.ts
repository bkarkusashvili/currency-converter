export interface ContentPoint {
  term: string;
  description: string;
}

export interface ContentSection {
  id: string;
  title: string;
  points: ContentPoint[];
}

export const purpose =
  'Currency Converter turns an amount in one currency into another using Monobank’s published exchange rates. It exists to show a small service built the way a production service is built: a domain that does not know what a database is, a cache that can fail without taking the request down with it, one error shape for every failure, and a client that tells you where each number came from.';

export const whatWasBuilt: ContentSection = {
  id: 'what-was-built',
  title: 'What was built',
  points: [
    {
      term: 'A NestJS API',
      description:
        'REST endpoints under /api/v1 for convert, rates, currencies and history, documented with Swagger at /docs, plus a terminus health endpoint reporting Redis, MongoDB and the Monobank circuit breaker.',
    },
    {
      term: 'Ports and adapters',
      description:
        'The domain depends on RatesProvider, RatesRepository and HistoryRepository interfaces bound through DI tokens. Monobank, Redis and Mongo are adapters behind them, so changing the rate source or the cache is a module binding, not a rewrite.',
    },
    {
      term: 'A strategy per rate path',
      description:
        'Identity, direct pair and cross rate through UAH, selected by a resolver at request time. Amounts are computed with big.js and rounded half-up; floating point never touches money.',
    },
    {
      term: 'Cache-aside with a stale fallback',
      description:
        'Each successful upstream fetch writes a fresh key (five minutes) and a fallback key (24 hours) in Redis. Concurrent misses share one in-flight call, so a burst of traffic produces a single request to Monobank.',
    },
    {
      term: 'Resilience around the upstream',
      description:
        'A per-request timeout, retry with exponential backoff and full jitter, and an in-house circuit breaker (CLOSED → OPEN → HALF_OPEN) whose state feeds the health endpoint. 429 is never retried: Monobank allows one request a minute.',
    },
    {
      term: 'One typed error envelope',
      description:
        'A small hierarchy of domain errors normalised by a global exception filter into { statusCode, code, message, details } with a timestamp, path and request id.',
    },
    {
      term: 'Graceful degradation',
      description:
        'Redis or Mongo being down is logged and surfaced on /health without failing a conversion. When Monobank is unreachable the response is served from the fallback snapshot and says so.',
    },
    {
      term: 'Operations',
      description:
        'pino request logging with a request id, environment validated by a zod schema at boot, multi-stage Docker images for both apps, a Compose file running api, web, Redis and Mongo, and GitHub Actions running lint, typecheck, tests and build.',
    },
    {
      term: 'This client',
      description:
        'React 19, Vite, TanStack Query and Tailwind v4 with a dark-aware token palette. src/api is the only place that speaks HTTP; components consume typed hooks. Vitest and Testing Library cover the form, the history panel, the HTTP client and this page.',
    },
  ],
};

export const whyTheseDecisions: ContentSection = {
  id: 'why-these-decisions',
  title: 'Why these decisions',
  points: [
    {
      term: 'Interfaces before infrastructure',
      description:
        'Depending on ports keeps the conversion rules testable without Redis, Mongo or the network, and it keeps infrastructure concerns from leaking into the part of the code that has the actual business rules in it.',
    },
    {
      term: 'Three strategies instead of one branch',
      description:
        'Identity, direct and cross are three different rules with three different failure modes. Keeping them apart keeps each one small and lets the API report which one it used — the strategy badge on the converter is that decision, surfaced.',
    },
    {
      term: 'Stale data beats no data',
      description:
        'Monobank rate-limits to one request a minute and does go down. An hour-old snapshot is more useful than a 503, as long as the response admits which one you are looking at. That is what the source badge is for.',
    },
    {
      term: 'Fail fast on config, degrade slowly at runtime',
      description:
        'Invalid environment stops the process at boot, where the mistake is cheap to notice. A dependency dying at runtime only removes the feature that needs it.',
    },
    {
      term: 'One error shape',
      description:
        'A single envelope means the client renders every failure through one component. VALIDATION_ERROR carries per-field messages, which the converter maps back onto its inputs instead of showing a generic failure.',
    },
    {
      term: 'Runtime configuration over build-time env',
      description:
        'A Vite build bakes env vars into the bundle. Reading window.__APP_CONFIG__ from config.js, rewritten by the container at start, means the same image runs locally and on a hosted environment with one variable changed.',
    },
  ],
};

export const howToRun = {
  id: 'how-to-run-it',
  title: 'How to run it',
  commands: [
    'git clone https://github.com/bkarkusashvili/currency-converter',
    'cd currency-converter',
    'docker compose up --build',
  ],
  notes: [
    'Compose starts the API on :3000, the web app on :8080, Redis and MongoDB. Swagger is at :3000/docs.',
    'Each app also runs on its own: npm ci && npm run dev inside apps/api or apps/web. The web app reads its API URL from public/config.js, so no rebuild is needed to point it somewhere else.',
  ],
};
