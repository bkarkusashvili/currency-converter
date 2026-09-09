import { createConnection, Connection, Model } from 'mongoose';
import { createFakePinoLogger } from '../../src/common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../src/config/__tests__/fake-config';
import { RatesSnapshot } from '../../src/modules/rates/domain/exchange-rate.types';
import { MongoRatesArchiveRepository } from '../../src/modules/rates/infrastructure/mongo-rates-archive.repository';
import {
  buildRateSnapshotSchema,
  RATE_SNAPSHOT_MODEL,
  RATE_SNAPSHOTS_COLLECTION,
  RateSnapshotDocument,
} from '../../src/modules/rates/schemas/rate-snapshot.schema';
import { describeAgainst } from './gate';

const TTL_DAYS = 90;
const SECONDS_PER_DAY = 86_400;
const OPERATION_TIMEOUT_MS = 5_000;

// A database of its own, like the Redis suite's database 15: the history suite
// drops the one its url names, and two suites that Jest may run in parallel
// must not be able to delete each other's collections.
const DB_NAME = 'currency_converter_rates_archive_integration';

// Dated against the clock rather than pinned: the window the adapter builds is
// "today and the days before it", so fixed dates would fall outside every
// window a later run asks for.
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

// Read once, so a suite that starts at 23:59:59 seeds and asserts the same day
// rather than two.
const TODAY = daysAgo(0);

function utcDay(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function atUtcHour(day: Date, hour: number): Date {
  const instant = new Date(day);
  instant.setUTCHours(hour, 0, 0, 0);

  return instant;
}

// Both shapes §5 allows, in one snapshot: a spread pair and a mid rate. The
// window read projects each of them, and a point carries one or the other.
function snapshotAt(instant: Date, buy: number): RatesSnapshot {
  return {
    fetchedAt: instant.toISOString(),
    rates: [
      {
        base: 'USD',
        quote: 'UAH',
        buy,
        sell: buy + 0.5,
        date: instant.toISOString(),
      },
      {
        base: 'EUR',
        quote: 'USD',
        cross: 1.16,
        date: instant.toISOString(),
      },
    ],
  };
}

const USD_UAH = { base: 'USD', quote: 'UAH' } as const;

interface StoredIndex {
  key: Record<string, number>;
  expireAfterSeconds?: number;
}

describeAgainst(
  'MongoRatesArchiveRepository against a real MongoDB',
  'INTEGRATION_MONGO_URL',
  (url) => {
    let connection: Connection;
    let model: Model<RateSnapshotDocument>;
    let repository: MongoRatesArchiveRepository;

    beforeAll(async () => {
      connection = createConnection(url, {
        // The same options the app connects with: buffering off means a write
        // against a connection that is not up fails rather than queueing.
        bufferCommands: false,
        autoIndex: false,
        dbName: DB_NAME,
      });
      await connection.asPromise();

      model = connection.model<RateSnapshotDocument>(
        RATE_SNAPSHOT_MODEL,
        buildRateSnapshotSchema(TTL_DAYS),
        RATE_SNAPSHOTS_COLLECTION,
      );

      // What RatesArchiveIndexes does at bootstrap, against a connection that
      // is open — which is the whole reason it does not leave it to mongoose.
      await model.syncIndexes();

      repository = new MongoRatesArchiveRepository(
        model,
        connection,
        fakeConfig({
          RATES_ARCHIVE_OPERATION_TIMEOUT_MS: OPERATION_TIMEOUT_MS,
        }),
        createFakePinoLogger().asPinoLogger(),
      );
    }, 30_000);

    afterAll(async () => {
      await connection.dropDatabase();
      await connection.close();
    });

    beforeEach(async () => {
      await model.deleteMany({});
    });

    // The TTL that never reached the collection is an archive that grows
    // without bound and nothing that says so — and the retention is also the
    // widest window /rates/history can honestly answer.
    it('holds an ascending fetchedAt index carrying the configured expiry', async () => {
      const indexes = (await model.collection.indexes()) as StoredIndex[];
      const fetchedAt = indexes.find(
        (index) => index.key.fetchedAt !== undefined,
      );

      expect(fetchedAt).toMatchObject({
        key: { fetchedAt: 1 },
        expireAfterSeconds: TTL_DAYS * SECONDS_PER_DAY,
      });
    });

    // Both reads ride on `_id`, which a day key already sorts in date order.
    it('adds no index beyond the expiry and the day key', async () => {
      const indexes = (await model.collection.indexes()) as StoredIndex[];

      expect(indexes).toHaveLength(2);
    });

    it('archives a snapshot and reads it back in the domain shape', async () => {
      const snapshot = snapshotAt(TODAY, 44.35);

      await expect(repository.save(snapshot)).resolves.toBe(true);

      await expect(repository.findLatest()).resolves.toStrictEqual({
        date: snapshot.fetchedAt.slice(0, 10),
        fetchedAt: snapshot.fetchedAt,
        rates: snapshot.rates,
      });
    });

    // The contract in one case: the day is the identity of the document, so the
    // second fetch of a day replaces the first rather than adding to it, and
    // what the day holds is the latest snapshot of it.
    it('replaces the same day rather than adding a second document', async () => {
      const morning = atUtcHour(TODAY, 6);
      const evening = atUtcHour(TODAY, 18);

      await repository.save(snapshotAt(morning, 44.1));
      await repository.save(snapshotAt(evening, 44.35));

      await expect(model.countDocuments({})).resolves.toBe(1);

      const latest = await repository.findLatest();

      expect(latest).toMatchObject({ fetchedAt: evening.toISOString() });
      expect(latest?.rates[0]).toMatchObject({ buy: 44.35 });
    });

    it('answers one projected day per archived day, oldest first', async () => {
      await repository.save(snapshotAt(daysAgo(1), 44.2));
      await repository.save(snapshotAt(daysAgo(3), 43.9));
      await repository.save(snapshotAt(TODAY, 44.35));

      const window = await repository.findPairWindow({ ...USD_UAH, days: 7 });

      expect(window.map((day) => day.rate?.buy)).toStrictEqual([
        43.9, 44.2, 44.35,
      ]);
    });

    // Counting today as the first day, so a window of two is today and
    // yesterday and the day before it is outside the question.
    it('honours the window it was asked for', async () => {
      await repository.save(snapshotAt(daysAgo(3), 43.9));
      await repository.save(snapshotAt(daysAgo(1), 44.2));
      await repository.save(snapshotAt(TODAY, 44.35));

      const window = await repository.findPairWindow({ ...USD_UAH, days: 2 });

      expect(window.map((day) => day.date)).toStrictEqual([
        utcDay(daysAgo(1)),
        utcDay(TODAY),
      ]);
    });

    // The read the route is built on: what leaves the server is the pair's own
    // numbers, not the day. `base`, `quote` and the upstream `date` are in the
    // document and in none of the answers below — a fake could only ever
    // confirm that the adapter asked for that, which is why this suite exists.
    it('projects the pair out of the day and nothing else', async () => {
      await repository.save(snapshotAt(TODAY, 44.35));

      const [day] = await repository.findPairWindow({ ...USD_UAH, days: 7 });

      expect(day).toStrictEqual({
        date: utcDay(TODAY),
        rate: { buy: 44.35, sell: 44.85 },
        quotesBase: true,
        quotesQuote: true,
      });
    });

    // A missing field resolves to nothing rather than to null in an
    // aggregation, which is what keeps a mid rate free of the two spread keys
    // (§5) without the mapper having to strip them.
    it('projects a mid rate without the spread keys', async () => {
      await repository.save(snapshotAt(TODAY, 44.35));

      const [day] = await repository.findPairWindow({
        base: 'EUR',
        quote: 'USD',
        days: 7,
      });

      expect(day?.rate).toStrictEqual({ cross: 1.16 });
    });

    // The two flags are what the UNSUPPORTED_CURRENCY decision is made from, so
    // they have to answer for a code the day quoted on either side of a pair
    // and for one it never mentions.
    it('flags each code the day quoted, on either side of a pair', async () => {
      await repository.save(snapshotAt(TODAY, 44.35));

      const [quoted] = await repository.findPairWindow({
        base: 'UAH',
        quote: 'USD',
        days: 7,
      });
      const [unquoted] = await repository.findPairWindow({
        base: 'XYZ',
        quote: 'UAH',
        days: 7,
      });

      // Both codes are archived; the pair in this orientation is not, which is
      // the RATE_NOT_AVAILABLE case rather than the unsupported one.
      expect(quoted).toMatchObject({ quotesBase: true, quotesQuote: true });
      expect(quoted?.rate).toBeUndefined();
      expect(unquoted).toMatchObject({ quotesBase: false, quotesQuote: true });
    });

    // A day dated ahead of the clock — a clock that ran fast, a document
    // written by hand — is not part of a window that ends today.
    it('never reads past today', async () => {
      await repository.save(snapshotAt(daysAgo(-1), 99));

      await expect(
        repository.findPairWindow({ ...USD_UAH, days: 7 }),
      ).resolves.toStrictEqual([]);
    });

    it('reads the newest day for the fallback, whatever order it was written in', async () => {
      await repository.save(snapshotAt(TODAY, 44.35));
      await repository.save(snapshotAt(daysAgo(4), 43.5));

      await expect(repository.findLatest()).resolves.toMatchObject({
        date: utcDay(TODAY),
      });
    });

    it('answers null for an archive that holds nothing', async () => {
      await expect(repository.findLatest()).resolves.toBeNull();
    });

    it('refuses a value the schema does not allow into the collection', async () => {
      await expect(
        repository.save({
          fetchedAt: TODAY.toISOString(),
          rates: [
            { base: 'USD', date: '2026-09-08T11:00:00.000Z' },
          ] as unknown as RatesSnapshot['rates'],
        }),
      ).resolves.toBe(false);
      await expect(repository.findLatest()).resolves.toBeNull();
    });
  },
);
