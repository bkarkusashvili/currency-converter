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
    ],
  };
}

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
      const snapshot = snapshotAt(daysAgo(0), 44.35);

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
      const morning = new Date(daysAgo(0).setUTCHours(6, 0, 0, 0));
      const evening = new Date(daysAgo(0).setUTCHours(18, 0, 0, 0));

      await repository.save(snapshotAt(morning, 44.1));
      await repository.save(snapshotAt(evening, 44.35));

      await expect(model.countDocuments({})).resolves.toBe(1);
      await expect(repository.findLatest()).resolves.toMatchObject({
        fetchedAt: evening.toISOString(),
        rates: [expect.objectContaining({ buy: 44.35 }) as unknown],
      });
    });

    it('answers one day per archived day, oldest first', async () => {
      await repository.save(snapshotAt(daysAgo(1), 44.2));
      await repository.save(snapshotAt(daysAgo(3), 43.9));
      await repository.save(snapshotAt(daysAgo(0), 44.35));

      const window = await repository.findWindow(7);

      expect(window.map((day) => day.rates[0]?.buy)).toStrictEqual([
        43.9, 44.2, 44.35,
      ]);
    });

    // Counting today as the first day, so a window of two is today and
    // yesterday and the day before it is outside the question.
    it('honours the window it was asked for', async () => {
      await repository.save(snapshotAt(daysAgo(3), 43.9));
      await repository.save(snapshotAt(daysAgo(1), 44.2));
      await repository.save(snapshotAt(daysAgo(0), 44.35));

      const window = await repository.findWindow(2);

      expect(window.map((day) => day.date)).toStrictEqual([
        daysAgo(1).toISOString().slice(0, 10),
        daysAgo(0).toISOString().slice(0, 10),
      ]);
    });

    it('reads the newest day for the fallback, whatever order it was written in', async () => {
      await repository.save(snapshotAt(daysAgo(0), 44.35));
      await repository.save(snapshotAt(daysAgo(4), 43.5));

      await expect(repository.findLatest()).resolves.toMatchObject({
        date: daysAgo(0).toISOString().slice(0, 10),
      });
    });

    it('answers null for an archive that holds nothing', async () => {
      await expect(repository.findLatest()).resolves.toBeNull();
    });

    it('refuses a value the schema does not allow into the collection', async () => {
      await expect(
        repository.save({
          fetchedAt: daysAgo(0).toISOString(),
          rates: [
            { base: 'USD', date: '2026-09-08T11:00:00.000Z' },
          ] as unknown as RatesSnapshot['rates'],
        }),
      ).resolves.toBe(false);
      await expect(repository.findLatest()).resolves.toBeNull();
    });
  },
);
