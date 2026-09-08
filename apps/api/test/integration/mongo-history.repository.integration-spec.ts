import { createConnection, Connection, Model } from 'mongoose';
import { createFakePinoLogger } from '../../src/common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../src/config/__tests__/fake-config';
import { NewConversionRecord } from '../../src/modules/history/domain/conversion-record';
import { MAX_HISTORY_LIMIT } from '../../src/modules/history/domain/history-limits';
import { MongoHistoryRepository } from '../../src/modules/history/infrastructure/mongo-history.repository';
import {
  buildConversionRecordSchema,
  CONVERSION_RECORD_MODEL,
  CONVERSIONS_COLLECTION,
  ConversionRecordDocument,
} from '../../src/modules/history/schemas/conversion-record.schema';
import { describeAgainst } from './gate';

const TTL_DAYS = 30;
const SECONDS_PER_DAY = 86_400;
const OPERATION_TIMEOUT_MS = 5_000;

const ENTRY: NewConversionRecord = {
  from: 'EUR',
  to: 'GBP',
  amount: 100,
  result: 85.09,
  rate: 0.850942,
  strategy: 'cross',
  source: 'cache',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
};

interface StoredIndex {
  key: Record<string, number>;
  expireAfterSeconds?: number;
}

describeAgainst(
  'MongoHistoryRepository against a real MongoDB',
  'INTEGRATION_MONGO_URL',
  (url) => {
    let connection: Connection;
    let model: Model<ConversionRecordDocument>;
    let repository: MongoHistoryRepository;

    beforeAll(async () => {
      connection = createConnection(url, {
        // The same options the app connects with: buffering off means a write
        // against a connection that is not up fails rather than queueing.
        bufferCommands: false,
        autoIndex: false,
      });
      await connection.asPromise();

      model = connection.model<ConversionRecordDocument>(
        CONVERSION_RECORD_MODEL,
        buildConversionRecordSchema(TTL_DAYS),
        CONVERSIONS_COLLECTION,
      );

      // What HistoryIndexes does at bootstrap, against a connection that is
      // open — which is the whole reason it does not leave it to mongoose.
      await model.syncIndexes();

      repository = new MongoHistoryRepository(
        model,
        connection,
        fakeConfig({ HISTORY_OPERATION_TIMEOUT_MS: OPERATION_TIMEOUT_MS }),
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

    // One row per amount, a minute apart, oldest first — saved with
    // `timestamps: false` so the schema's own stamping does not overwrite the
    // order being set up.
    async function seed(amounts: number[]): Promise<void> {
      const base = Date.parse('2026-09-08T12:00:00.000Z');
      const ordered = [...amounts].sort((first, second) => first - second);

      for (const [index, amount] of ordered.entries()) {
        await new model({
          ...ENTRY,
          amount,
          ratesTimestamp: new Date(ENTRY.ratesTimestamp),
          createdAt: new Date(base + index * 60_000),
        }).save({ timestamps: false });
      }
    }

    // The one index, doing both jobs: the newest-first page and the expiry ride
    // on the same key, and a TTL that never reached the collection is a demo
    // database that grows without bound and nothing that says so.
    it('holds one descending createdAt index carrying the configured expiry', async () => {
      const indexes = (await model.collection.indexes()) as StoredIndex[];
      const createdAt = indexes.find(
        (index) => index.key.createdAt !== undefined,
      );

      expect(createdAt).toMatchObject({
        key: { createdAt: -1 },
        expireAfterSeconds: TTL_DAYS * SECONDS_PER_DAY,
      });
      expect(
        indexes.filter((index) => index.key.createdAt !== undefined),
      ).toHaveLength(1);
    });

    it('records a conversion and reads it back in the shape §3 publishes', async () => {
      await expect(repository.record(ENTRY)).resolves.toBe(true);

      const [record] = await repository.findRecent(10);

      expect(record).toMatchObject(ENTRY);
      // The store owns these two, and both leave the adapter as ISO strings
      // even though the collection holds BSON dates.
      expect(record?.id).toEqual(expect.any(String));
      expect(record?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record?.ratesTimestamp).toBe(ENTRY.ratesTimestamp);
    });

    // Seeded with explicit timestamps rather than by recording three in a row:
    // `record` stamps createdAt from the clock, and three writes inside the
    // same millisecond are three rows the index cannot order between. What is
    // under test is the query, so the rows are given an order to have.
    it('answers newest first, which is the order the index is read in', async () => {
      await seed([3, 1, 2]);

      const records = await repository.findRecent(10);

      expect(records.map((record) => record.amount)).toStrictEqual([3, 2, 1]);
    });

    it('serves at most the page it was asked for, newest first', async () => {
      await seed([1, 2, 3]);

      const page = await repository.findRecent(2);

      expect(page.map((record) => record.amount)).toStrictEqual([3, 2]);
    });

    // The adapter refuses to build a query it cannot bound, whatever a caller
    // that is not the DTO asks for. Seeded one row past the ceiling, because
    // that is the smallest collection where the clamp is the only thing
    // standing between the request and a row it must not return: with fewer
    // rows than the ceiling the assertion holds whether or not `Math.min` is
    // there, which is what this case used to assert.
    it('clamps a page past the ceiling to the ceiling, newest first', async () => {
      const amounts = Array.from(
        { length: MAX_HISTORY_LIMIT + 1 },
        (_unused, index) => index + 1,
      );
      await seed(amounts);

      const page = await repository.findRecent(MAX_HISTORY_LIMIT + 500);

      expect(page).toHaveLength(MAX_HISTORY_LIMIT);
      // The clamp truncates the page, it does not reorder it: the row that
      // falls off is the oldest, not the last one written.
      expect(page.map((record) => record.amount)).toStrictEqual(
        [...amounts].reverse().slice(0, MAX_HISTORY_LIMIT),
      );
    });

    it('refuses a value the schema does not allow into the collection', async () => {
      await expect(
        repository.record({
          ...ENTRY,
          strategy: 'invented' as NewConversionRecord['strategy'],
        }),
      ).resolves.toBe(false);
      await expect(repository.findRecent(10)).resolves.toHaveLength(0);
    });
  },
);
