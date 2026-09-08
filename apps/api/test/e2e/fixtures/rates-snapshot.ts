import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  ExchangeRate,
  RatesSnapshot,
} from '../../../src/modules/rates/domain/exchange-rate';

// The rates and the conversions of them both live at the repository root, in
// JSON, because the web app's offline estimate is tested against exactly the
// same numbers (apps/web/src/test/golden-fixtures.ts reads these two files
// too). They used to be two hand-copied tables and two of the five pairs had
// already drifted apart, so neither suite was checking what its comment said it
// was. Read rather than imported: the API's build has `rootDir: ./src`, and a
// module outside it would not compile even though only tests use it.
const FIXTURES_DIR = join(__dirname, '../../../../../fixtures');

const exchangeRateSchema = z.object({
  base: z.string(),
  quote: z.string(),
  buy: z.number().optional(),
  sell: z.number().optional(),
  cross: z.number().optional(),
  date: z.string(),
});

const snapshotSchema = z.object({
  fetchedAt: z.string(),
  rates: z.array(exchangeRateSchema).min(1),
});

const goldenSchema = z.object({
  vectors: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        amount: z.number(),
        rate: z.number(),
        result: z.number(),
        strategy: z.enum(['identity', 'direct', 'cross']),
        note: z.string().optional(),
      }),
    )
    .min(8),
});

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as unknown;
}

export const RATES_SNAPSHOT: RatesSnapshot = snapshotSchema.parse(
  readFixture('rates-snapshot.json'),
);

export type GoldenConversion = z.infer<
  typeof goldenSchema
>['vectors'][number] & {
  from: ExchangeRate['base'];
  to: ExchangeRate['quote'];
};

// Every conversion both implementations have to agree on, asserted one HTTP
// request at a time by the conversion suite.
export const GOLDEN_CONVERSIONS = goldenSchema.parse(
  readFixture('golden-conversions.json'),
).vectors as GoldenConversion[];

export const SNAPSHOT_CURRENCIES = [
  { code: 'EUR', numericCode: 978, name: 'Euro' },
  { code: 'GBP', numericCode: 826, name: 'Pound Sterling' },
  { code: 'PLN', numericCode: 985, name: 'Zloty' },
  { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
  { code: 'USD', numericCode: 840, name: 'US Dollar' },
];

// A snapshot with a currency the API knows and cannot price: CHF is quoted, but
// only against the dollar, so it has no leg to the hryvnia to cross through.
// Both codes of CHF/PLN are in the snapshot and there is still no path between
// them, which is the difference between the two 422s in §3. It stays inline
// because nothing else converts against it.
export const DETACHED_RATES_SNAPSHOT: RatesSnapshot = {
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    {
      base: 'CHF',
      quote: 'USD',
      cross: 1.2543,
      date: '2026-09-08T11:00:00.000Z',
    },
    {
      base: 'PLN',
      quote: 'UAH',
      cross: 12.1834,
      date: '2026-09-08T11:00:00.000Z',
    },
  ],
};
