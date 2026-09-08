import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

const commaSeparatedList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )
  .pipe(z.array(z.string().min(1)).min(1));

// Express `trust proxy`: false trusts nobody, true trusts every hop, and a
// number is how many proxies sit between the client and this process. It
// decides whether req.ip is the caller or the load balancer, which is both what
// the throttler keys its buckets on and what the request log reports.
const trustProxy = z
  .union([
    z.enum(['true', 'false']).transform((value) => value === 'true'),
    z.coerce.number().int().min(0).max(10),
  ])
  .default(false);

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: trustProxy,
    CORS_ORIGINS: commaSeparatedList.default([
      'http://localhost:5173',
      'http://localhost:8080',
    ]),
    REDIS_URL: z.url().default('redis://localhost:6379'),
    // Deadline for a single Redis command. `maxRetriesPerRequest` bounds the
    // reconnects that follow a socket error, not a command sitting on a socket
    // that never answers, and the cache is on the request path.
    REDIS_COMMAND_TIMEOUT_MS: positiveInt.default(300),
    MONGO_URL: z.url().default('mongodb://localhost:27017/currency_converter'),
    // How long the driver looks for a reachable server before giving up. The
    // default of 30s is a deadline for a conversion that only writes a history
    // record; §2 keeps that request answering while Mongo is down.
    MONGO_SERVER_SELECTION_TIMEOUT_MS: positiveInt.default(3000),
    // How long a conversion record is kept. A demo collection nobody prunes
    // grows without bound, and nothing in the product reads a month-old
    // conversion; the TTL index is what enforces it.
    HISTORY_TTL_DAYS: positiveInt.default(30),
    MONOBANK_API_URL: z.url().default('https://api.monobank.ua/bank/currency'),
    MONOBANK_TIMEOUT_MS: positiveInt.default(5000),
    MONOBANK_RETRY_ATTEMPTS: positiveInt.default(3),
    MONOBANK_RETRY_BASE_DELAY_MS: positiveInt.default(300),
    // Ceiling on one upstream call including every retry and the backoff
    // between them. MONOBANK_TIMEOUT_MS bounds a single request; this bounds
    // how long a caller waits before the stale copy is served instead.
    MONOBANK_TOTAL_BUDGET_MS: positiveInt.default(8000),
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: positiveInt.default(5),
    CIRCUIT_BREAKER_RESET_TIMEOUT_MS: positiveInt.default(30000),
    RATES_CACHE_TTL_SECONDS: positiveInt.default(300),
    RATES_STALE_TTL_SECONDS: positiveInt.default(86400),
    THROTTLE_TTL_SECONDS: positiveInt.default(60),
    THROTTLE_LIMIT: positiveInt.default(60),
    // Null rather than undefined so that a validated read stays non-nullable in
    // ConfigService<AppConfig, true>; null is the "cache invalidation is open" case.
    ADMIN_API_KEY: z.string().min(1).nullable().default(null),
  })
  // DELETE /rates/cache clears the snapshot every instance reads, and
  // ApiKeyGuard is a deliberate no-op while the key is unset so a local run
  // needs no secret. That leaves the route open to anyone who can reach the
  // deployment: a lever on an upstream that allows one request a minute, since
  // alternating DELETE and GET spends the budget the cache exists to protect.
  // Development and test stay permissive; production has to name a key.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.ADMIN_API_KEY === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_API_KEY'],
        message:
          'is required when NODE_ENV is production, where an unset key leaves DELETE /rates/cache open to anyone',
      });
    }
  });
