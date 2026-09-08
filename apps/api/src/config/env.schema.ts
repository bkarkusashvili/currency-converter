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

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGINS: commaSeparatedList.default([
    'http://localhost:5173',
    'http://localhost:8080',
  ]),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  MONGO_URL: z.url().default('mongodb://localhost:27017/currency_converter'),
  MONOBANK_API_URL: z.url().default('https://api.monobank.ua/bank/currency'),
  MONOBANK_TIMEOUT_MS: positiveInt.default(5000),
  MONOBANK_RETRY_ATTEMPTS: positiveInt.default(3),
  MONOBANK_RETRY_BASE_DELAY_MS: positiveInt.default(300),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: positiveInt.default(5),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: positiveInt.default(30000),
  RATES_CACHE_TTL_SECONDS: positiveInt.default(300),
  RATES_STALE_TTL_SECONDS: positiveInt.default(86400),
  THROTTLE_TTL_SECONDS: positiveInt.default(60),
  THROTTLE_LIMIT: positiveInt.default(60),
  // Null rather than undefined so that a validated read stays non-nullable in
  // ConfigService<AppConfig, true>; null is the "cache invalidation is open" case.
  ADMIN_API_KEY: z.string().min(1).nullable().default(null),
});
