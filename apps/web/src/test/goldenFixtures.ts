import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConversionStrategy, ExchangeRate, RatesSnapshotResponse } from '../api';

/**
 * The rates, and the conversions of them, that the API's e2e suite asserts —
 * read from the same two files at the repository root rather than copied.
 *
 * They used to be copied, and two of the five pairs had drifted: the offline
 * estimate's fixture said EUR/UAH was 51.47 while the API priced it at 51.7,
 * so the comment claiming "same input, same output" was not true and nothing
 * in CI could have noticed. Read with `fs` rather than imported as JSON,
 * because the web image builds from `apps/web` alone: an import would be a
 * module the production build cannot resolve, while a path is only a string
 * until a test runs. `npm run check:fixtures` validates both files.
 */
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../fixtures');

export interface GoldenConversion {
  from: string;
  to: string;
  amount: number;
  rate: number;
  result: number;
  strategy: ConversionStrategy;
  note?: string;
}

const STRATEGIES: readonly string[] = ['identity', 'direct', 'cross'];

function fail(name: string, why: string): never {
  throw new Error(`fixtures/${name} is not usable: ${why}. Run \`npm run check:fixtures\`.`);
}

function readFixture(name: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));

  if (typeof parsed !== 'object' || parsed === null) {
    fail(name, 'it is not a JSON object');
  }

  return parsed as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The shared snapshot, in the shape `GET /rates` answers with. */
export function goldenSnapshot(): RatesSnapshotResponse {
  const { fetchedAt, rates } = readFixture('rates-snapshot.json');

  if (typeof fetchedAt !== 'string' || !Array.isArray(rates) || rates.length === 0) {
    fail('rates-snapshot.json', 'it has no fetchedAt or no published pairs');
  }

  return {
    // The file is a snapshot, not a response; `source` is what a persisted copy
    // of one carries, and the estimate reads it back the same way.
    source: 'cache',
    fetchedAt,
    rates: rates.map((rate: unknown): ExchangeRate => {
      if (
        !isRecord(rate) ||
        typeof rate.base !== 'string' ||
        typeof rate.quote !== 'string' ||
        typeof rate.date !== 'string'
      ) {
        fail('rates-snapshot.json', 'a published pair is missing base, quote or date');
      }

      return rate as unknown as ExchangeRate;
    }),
  };
}

/** Every conversion of that snapshot both implementations have to agree on. */
export function goldenConversions(): GoldenConversion[] {
  const { vectors } = readFixture('golden-conversions.json');

  if (!Array.isArray(vectors) || vectors.length < 8) {
    fail('golden-conversions.json', 'it carries fewer than eight vectors');
  }

  return vectors.map((vector: unknown): GoldenConversion => {
    if (
      !isRecord(vector) ||
      typeof vector.from !== 'string' ||
      typeof vector.to !== 'string' ||
      typeof vector.amount !== 'number' ||
      typeof vector.rate !== 'number' ||
      typeof vector.result !== 'number' ||
      typeof vector.strategy !== 'string' ||
      !STRATEGIES.includes(vector.strategy)
    ) {
      fail('golden-conversions.json', `a vector is incomplete: ${JSON.stringify(vector)}`);
    }

    return vector as unknown as GoldenConversion;
  });
}
