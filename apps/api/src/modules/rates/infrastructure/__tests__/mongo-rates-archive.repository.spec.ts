import { Model } from 'mongoose';
import { ArchiveUnavailableError } from '../../../../common/errors/archive-unavailable.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../../../config/__tests__/fake-config';
import { FakeMongoConnection } from '../../../../infrastructure/mongo/__tests__/fake-mongo-connection';
import { RatesSnapshot } from '../../domain/exchange-rate.types';
import { MAX_RATE_HISTORY_DAYS } from '../../domain/rate-history-window.constants';
import { RateHistoryQuery } from '../../domain/rate-history.types';
import { RateSnapshotDocument } from '../../schemas/rate-snapshot.schema';
import { MongoRatesArchiveRepository } from '../mongo-rates-archive.repository';

const SNAPSHOT: RatesSnapshot = {
  // Late in the UTC day on purpose: a local-time key would file this under the
  // ninth in half the world, which is the second document per day the contract
  // says the collection never holds.
  fetchedAt: '2026-09-08T23:40:00.000Z',
  rates: [
    {
      base: 'USD',
      quote: 'UAH',
      buy: 44.35,
      sell: 44.831,
      date: '2026-09-08T11:00:00.000Z',
    },
  ],
};

// What the driver hands back: `fetchedAt` is a BSON date in the collection, and
// turning it into the ISO string the domain speaks is the mapper's job.
const STORED = {
  _id: '2026-09-08',
  fetchedAt: new Date(SNAPSHOT.fetchedAt),
  rates: [
    {
      base: 'USD',
      quote: 'UAH',
      buy: 44.35,
      sell: 44.831,
      cross: undefined,
      date: '2026-09-08T11:00:00.000Z',
    },
  ],
};

// The window the reads below ask for, unless they are about the window itself.
const WEEK: RateHistoryQuery = { base: 'USD', quote: 'UAH', days: 7 };

// Short enough that the suite waits it out in real time rather than mocking the
// clock the helper reads, and long enough that a machine under load does not
// expire it on a path meant to resolve first.
const OPERATION_TIMEOUT_MS = 20;

const config = fakeConfig({
  RATES_ARCHIVE_OPERATION_TIMEOUT_MS: OPERATION_TIMEOUT_MS,
});

// The stall the guard cannot see: the connection is up as far as mongoose
// knows, so only the deadline ever ends the wait.
const NEVER_ANSWERS = new Promise<never>(() => undefined);

// Declared as properties rather than by extending the mongoose types: a
// jest.Mock read off a method signature is what the unbound-method rule exists
// to catch, and the query is a chain the repository is asserted to have built.
interface QueryDouble {
  sort: jest.Mock;
  limit: jest.Mock;
  lean: jest.Mock;
  exec: jest.Mock;
}

interface ModelDouble {
  updateOne: jest.Mock;
  find: jest.Mock;
  aggregate: jest.Mock;
}

function createQuery(result: Promise<unknown>): QueryDouble {
  const query: QueryDouble = {
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn(() => query),
    exec: jest.fn(() => result),
  };

  return query;
}

// What the window read answers with: the day key, the pair projected out of it
// and the two membership flags. Nothing else leaves the server.
const PROJECTED = {
  _id: '2026-09-08',
  rate: { buy: 44.35, sell: 44.831 },
  quotesBase: true,
  quotesQuote: true,
};

// The stages the adapter builds, in order.
function pipelineOf(model: ModelDouble): Record<string, unknown>[] {
  const [pipeline] = model.aggregate.mock.calls[0] as [
    Record<string, unknown>[],
  ];

  return pipeline;
}

// Frozen at a fixed UTC instant: both ends of the window are dated from the
// clock, and the assertions below name the days they resolve to.
async function onTheEighth(read: () => Promise<unknown>): Promise<void> {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-08T06:00:00.000Z'));

  try {
    await read();
  } finally {
    jest.useRealTimers();
  }
}

describe('MongoRatesArchiveRepository', () => {
  let connection: FakeMongoConnection;
  let logger: FakePinoLogger;
  let model: ModelDouble;
  let query: QueryDouble;
  let aggregation: QueryDouble;
  let write: QueryDouble;
  let repository: MongoRatesArchiveRepository;

  function build(
    documents: unknown[] = [STORED],
    projected: unknown[] = [PROJECTED],
  ): void {
    query = createQuery(Promise.resolve(documents));
    aggregation = createQuery(Promise.resolve(projected));
    write = createQuery(Promise.resolve({ upsertedCount: 1 }));
    model = {
      updateOne: jest.fn(() => write),
      find: jest.fn(() => query),
      aggregate: jest.fn(() => aggregation),
    };
    repository = new MongoRatesArchiveRepository(
      model as unknown as Model<RateSnapshotDocument>,
      connection.asConnection(),
      config,
      logger.asPinoLogger(),
    );
  }

  beforeEach(() => {
    connection = new FakeMongoConnection();
    logger = createFakePinoLogger();
    build();
  });

  describe('with the connection up', () => {
    beforeEach(() => {
      connection.settle();
    });

    // The whole uniqueness rule, in the filter: the day is the identity of the
    // document, so a second fetch on the same day replaces the first rather
    // than adding to it.
    it('upserts the day the snapshot was fetched on, keyed in UTC', async () => {
      await expect(repository.save(SNAPSHOT)).resolves.toBe(true);

      expect(model.updateOne).toHaveBeenCalledWith(
        { _id: '2026-09-08' },
        {
          $set: {
            fetchedAt: new Date(SNAPSHOT.fetchedAt),
            rates: SNAPSHOT.rates,
          },
        },
        { upsert: true, runValidators: true },
      );
    });

    it('reads the newest day for the fallback', async () => {
      await repository.findLatest();

      expect(query.sort).toHaveBeenCalledWith({ _id: -1 });
      expect(query.limit).toHaveBeenCalledWith(1);
    });

    it('publishes the document as the domain snapshot', async () => {
      await expect(repository.findLatest()).resolves.toStrictEqual({
        date: '2026-09-08',
        fetchedAt: SNAPSHOT.fetchedAt,
        rates: SNAPSHOT.rates,
      });
    });

    // The key that is missing is what says "the archive is empty", and the
    // service reads it as one more tier with nothing in it.
    it('answers null when the archive holds no day at all', async () => {
      build([]);

      await expect(repository.findLatest()).resolves.toBeNull();
    });

    // A UTC day key sorts lexicographically in date order, which is why the
    // window is a range on `_id` and needs no second index. The upper bound is
    // today: a document dated ahead of the clock is not part of a window that
    // ends now.
    it('reads a window as a bounded range on the day key, oldest first', async () => {
      await onTheEighth(() => repository.findPairWindow(WEEK));

      const [match, sort] = pipelineOf(model);

      expect(match).toStrictEqual({
        $match: { _id: { $gte: '2026-09-02', $lte: '2026-09-08' } },
      });
      expect(sort).toStrictEqual({ $sort: { _id: 1 } });
    });

    // A window of one is today alone, which is what "the last day" means to
    // whoever asked for it.
    it('counts today as the first day of the window', async () => {
      await onTheEighth(() => repository.findPairWindow({ ...WEEK, days: 1 }));

      expect(pipelineOf(model)[0]).toStrictEqual({
        $match: { _id: { $gte: '2026-09-08', $lte: '2026-09-08' } },
      });
    });

    // The DTO bounds what a request can ask for; the port is reachable without
    // one, and an unbounded window is a scan of the whole collection. The
    // `$limit` bounds what the range can return even so: at most one document
    // per day exists, so it can only bite if the collection is not what the
    // contract says it is.
    it('never reads past the window ceiling, whatever it is asked for', async () => {
      await onTheEighth(async () => {
        await repository.findPairWindow({
          ...WEEK,
          days: MAX_RATE_HISTORY_DAYS * 100,
        });
        await repository.findPairWindow({
          ...WEEK,
          days: MAX_RATE_HISTORY_DAYS,
        });
      });

      const calls = model.aggregate.mock.calls as unknown[][];

      expect(calls[0]).toStrictEqual(calls[1]);
      expect(pipelineOf(model)[2]).toStrictEqual({
        $limit: MAX_RATE_HISTORY_DAYS,
      });
    });

    // The whole point of the read: a day document is the published board and
    // the answer is three numbers of it, so the filter runs in the server and
    // `base`, `quote` and the upstream `date` never cross the wire.
    it('projects the pair in exactly the orientation it was asked for', async () => {
      await repository.findPairWindow(WEEK);

      expect(pipelineOf(model)[3]).toMatchObject({
        $project: {
          rate: {
            $first: {
              $map: {
                input: {
                  $filter: {
                    input: '$rates',
                    cond: {
                      $and: [
                        { $eq: ['$$rate.base', 'USD'] },
                        { $eq: ['$$rate.quote', 'UAH'] },
                      ],
                    },
                  },
                },
                in: {
                  buy: '$$rate.buy',
                  sell: '$$rate.sell',
                  cross: '$$rate.cross',
                },
              },
            },
          },
        },
      });
    });

    // What is left of the day that the answer depends on: whether each code was
    // quoted anywhere in it, which is the UNSUPPORTED_CURRENCY decision and one
    // boolean rather than the day's code list.
    it('answers a membership flag per code beside the pair', async () => {
      await repository.findPairWindow(WEEK);

      const { $project } = pipelineOf(model)[3] as {
        $project: Record<string, unknown>;
      };

      expect(JSON.stringify($project.quotesBase)).toContain(
        '["$$rate.base","USD"]',
      );
      expect(JSON.stringify($project.quotesQuote)).toContain(
        '["$$rate.quote","UAH"]',
      );
      expect(Object.keys($project).sort()).toStrictEqual([
        '_id',
        'quotesBase',
        'quotesQuote',
        'rate',
      ]);
    });

    it('publishes the projected day as the domain shape', async () => {
      await expect(repository.findPairWindow(WEEK)).resolves.toStrictEqual([
        {
          date: '2026-09-08',
          rate: { buy: 44.35, sell: 44.831 },
          quotesBase: true,
          quotesQuote: true,
        },
      ]);
    });

    // A day that archived rates but not this pair carries no `rate` key at all,
    // which is what the service reads as a gap rather than as a zero.
    it('carries no rate for a day that did not publish the pair', async () => {
      build(
        [STORED],
        [{ _id: '2026-09-08', quotesBase: true, quotesQuote: false }],
      );

      const [day] = await repository.findPairWindow(WEEK);

      expect(day).toStrictEqual({
        date: '2026-09-08',
        quotesBase: true,
        quotesQuote: false,
      });
    });

    // The archive is not part of the answer: a write that fails costs a log
    // line and a warning on the response, and nothing else.
    it('swallows a write that fails, with the reason', async () => {
      write.exec.mockReturnValue(
        Promise.reject(new Error('E11000 duplicate key')),
      );

      await expect(repository.save(SNAPSHOT)).resolves.toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        'Rate snapshot archive write failed, dropping the day',
      );
    });

    // The read is the opposite: the service turns this into the documented 503
    // rather than an empty series, which reads as "never published".
    it('lets a failing read through', async () => {
      aggregation.exec.mockReturnValue(
        Promise.reject(new Error('connection timed out')),
      );

      await expect(repository.findPairWindow(WEEK)).rejects.toThrow(
        'connection timed out',
      );
    });
  });

  // `readyState` reports the topology mongoose last observed, so a server that
  // has gone away or merely slowed down still passes the guard. Without a
  // deadline the write would sit there holding open the response that fetched
  // the snapshot it is archiving.
  describe('against a server that stops answering', () => {
    beforeEach(() => {
      connection.settle();
    });

    it('drops the write rather than waiting the driver out', async () => {
      write.exec.mockReturnValue(NEVER_ANSWERS);

      await expect(repository.save(SNAPSHOT)).resolves.toBe(false);
    });

    // The same outage as a disconnected store, so the same one line: a hung
    // Mongo would otherwise warn once per refresh for as long as it hangs.
    it('reports the outage once rather than once per fetch', async () => {
      write.exec.mockReturnValue(NEVER_ANSWERS);

      await repository.save(SNAPSHOT);
      await repository.save(SNAPSHOT);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        { err: undefined },
        'MongoDB is not connected, rate snapshots are served but not archived',
      );
    });

    it('answers a read with the documented outage', async () => {
      aggregation.exec.mockReturnValue(NEVER_ANSWERS);

      await expect(repository.findPairWindow(WEEK)).rejects.toBeInstanceOf(
        ArchiveUnavailableError,
      );
    });

    it('names the deadline as the reason', async () => {
      query.exec.mockReturnValue(NEVER_ANSWERS);

      await expect(repository.findLatest()).rejects.toMatchObject({
        details: { reason: 'timeout' },
      });
    });

    // The store coming back is what closes the outage, and the write is what
    // proves it: the deadline must not leave the flag stuck.
    it('archives again once the server answers', async () => {
      write.exec.mockReturnValueOnce(NEVER_ANSWERS);

      await repository.save(SNAPSHOT);

      await expect(repository.save(SNAPSHOT)).resolves.toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'MongoDB is reachable again, rate snapshots are being archived',
      );
    });
  });

  describe('with the connection down', () => {
    it('drops the write without issuing a command', async () => {
      await expect(repository.save(SNAPSHOT)).resolves.toBe(false);

      expect(model.updateOne).not.toHaveBeenCalled();
    });

    // An empty series would say the pair was never published; the store being
    // unreadable is a different answer and §3 gives it a different code.
    it('refuses to read rather than answering an empty window', async () => {
      await expect(repository.findPairWindow(WEEK)).rejects.toMatchObject({
        details: { reason: 'connection not ready' },
      });

      expect(model.aggregate).not.toHaveBeenCalled();
    });

    it('refuses the fallback read on the same terms', async () => {
      await expect(repository.findLatest()).rejects.toBeInstanceOf(
        ArchiveUnavailableError,
      );
    });
  });
});
