import goldenConversionsFixture from '../../../../fixtures/golden-conversions.json';
import ratesSnapshotFixture from '../../../../fixtures/rates-snapshot.json';
import type { ConversionStrategy, ExchangeRate, RatesSnapshotResponse } from '../api/types';

/**
 * The rates, and the conversions of them, that the API's e2e suite asserts —
 * read from the same two files at the repository root rather than copied.
 *
 * They used to be copied, and two of the five pairs had drifted: the offline
 * estimate's fixture said EUR/UAH was 51.47 while the API priced it at 51.7,
 * so the comment claiming "same input, same output" was not true and nothing
 * in CI could have noticed. The files are JSON and imported rather than read
 * with `fs` for one reason: `tsconfig.app.json` deliberately types this project
 * with `vite/client` alone, and pulling in Node's globals to call
 * `readFileSync` would let browser code reach for `process` and still compile.
 * The API side, which has no `resolveJsonModule` and a `rootDir`, reads them
 * with `fs` and zod instead. `npm run check:fixtures` validates both files for
 * both readers.
 */

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

/** The shared snapshot, in the shape `GET /rates` answers with. */
export function goldenSnapshot(): RatesSnapshotResponse {
  // Every published pair carries a spread or a mid rate; `check:fixtures` is
  // what enforces that, and TypeScript reads it off the file here.
  const rates: ExchangeRate[] = ratesSnapshotFixture.rates;

  return {
    // The file is a snapshot, not a response; `source` is what a persisted copy
    // of one carries, and the estimate reads it back the same way.
    source: 'cache',
    fetchedAt: ratesSnapshotFixture.fetchedAt,
    rates,
  };
}

/** Every conversion of that snapshot both implementations have to agree on. */
export function goldenConversions(): GoldenConversion[] {
  const { vectors } = goldenConversionsFixture;

  if (vectors.length < 8) {
    fail(
      'golden-conversions.json',
      `it carries ${String(vectors.length)} vectors, fewer than eight`,
    );
  }

  return vectors.map((vector) => {
    if (!STRATEGIES.includes(vector.strategy)) {
      fail('golden-conversions.json', `${vector.strategy} is not a strategy this client knows`);
    }

    return vector as GoldenConversion;
  });
}
