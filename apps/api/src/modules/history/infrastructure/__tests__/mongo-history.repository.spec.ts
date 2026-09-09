import { Model, Types } from 'mongoose';
import { HistoryUnavailableError } from '../../../../common/errors/history-unavailable.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../../../config/__tests__/fake-config';
import { FakeMongoConnection } from '../../../../infrastructure/mongo/__tests__/fake-mongo-connection';
import { NewConversionRecord } from '../../domain/conversion-record.types';
import { MAX_HISTORY_LIMIT } from '../../domain/history-limits.constants';
import { ConversionRecordDocument } from '../../schemas/conversion-record.schema';
import { MongoHistoryRepository } from '../mongo-history.repository';
import { ConversionStrategyName } from '../../../../common/conversion/conversion-strategy-name.enum';
import { RatesSource } from '../../../rates/domain/rates-source.enum';

const ENTRY: NewConversionRecord = {
  from: 'EUR',
  to: 'GBP',
  amount: 100,
  result: 85.09,
  rate: 0.850942,
  strategy: ConversionStrategyName.Cross,
  source: RatesSource.Cache,
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
};

const STORED_ID = new Types.ObjectId('6f0000000000000000000001');
const CREATED_AT = new Date('2026-09-08T12:00:05.000Z');

// What the driver hands back: both timestamps are BSON dates in the collection,
// and turning them into the ISO strings §3 publishes is the mapper's job.
const STORED = {
  ...ENTRY,
  _id: STORED_ID,
  ratesTimestamp: new Date(ENTRY.ratesTimestamp),
  createdAt: CREATED_AT,
};

// Short enough that the suite waits it out in real time rather than mocking the
// clock the helper reads, and long enough that a machine under load does not
// expire it on a path meant to resolve first.
const OPERATION_TIMEOUT_MS = 20;

const config = fakeConfig({
  HISTORY_OPERATION_TIMEOUT_MS: OPERATION_TIMEOUT_MS,
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
  create: jest.Mock;
  find: jest.Mock;
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

describe('MongoHistoryRepository', () => {
  let connection: FakeMongoConnection;
  let logger: FakePinoLogger;
  let model: ModelDouble;
  let query: QueryDouble;
  let repository: MongoHistoryRepository;

  function build(documents: unknown[] = [STORED]): void {
    query = createQuery(Promise.resolve(documents));
    model = {
      create: jest.fn().mockResolvedValue(STORED),
      find: jest.fn(() => query),
    };
    repository = new MongoHistoryRepository(
      model as unknown as Model<ConversionRecordDocument>,
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

    it('writes the record it was given', async () => {
      await expect(repository.record(ENTRY)).resolves.toBe(true);

      expect(model.create).toHaveBeenCalledWith(ENTRY);
    });

    it('reads the most recent records first, no more than asked for', async () => {
      await repository.findRecent(5);

      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(query.limit).toHaveBeenCalledWith(5);
      expect(query.lean).toHaveBeenCalled();
    });

    // The DTO bounds what a request can ask for; the port is reachable without
    // one, and an unbounded limit is a full collection scan behind a route that
    // answers a page.
    it('never reads past the page ceiling, whatever it is asked for', async () => {
      await repository.findRecent(MAX_HISTORY_LIMIT * 100);

      expect(query.limit).toHaveBeenCalledWith(MAX_HISTORY_LIMIT);
    });

    it('publishes the document as the domain record', async () => {
      await expect(repository.findRecent(10)).resolves.toStrictEqual([
        {
          id: STORED_ID.toString(),
          from: 'EUR',
          to: 'GBP',
          amount: 100,
          result: 85.09,
          rate: 0.850942,
          strategy: ConversionStrategyName.Cross,
          source: RatesSource.Cache,
          ratesTimestamp: '2026-09-08T12:00:00.000Z',
          createdAt: CREATED_AT.toISOString(),
        },
      ]);
    });

    // The record is not part of the answer: a write that fails costs a log line
    // and nothing else.
    it('swallows a write that fails, with the reason', async () => {
      model.create.mockRejectedValue(new Error('E11000 duplicate key'));

      // Not recorded, and it says so: /history will not have this conversion,
      // which is the one part of the outage the client cannot see.
      await expect(repository.record(ENTRY)).resolves.toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        'Conversion history write failed, dropping the record',
      );
    });

    // The read is the opposite: the service turns this into the documented 503
    // rather than answering an empty page that reads as "nothing converted yet".
    it('lets a failing read through', async () => {
      query.exec.mockReturnValue(
        Promise.reject(new Error('connection timed out')),
      );

      await expect(repository.findRecent(10)).rejects.toThrow(
        'connection timed out',
      );
    });

    // `readyState` reports the topology mongoose last observed, so a server
    // that has gone away or merely slowed down still passes the guard. Without
    // a deadline the write would sit there for the server-selection budget, or
    // for as long as the server takes, holding the conversion open behind it.
    describe('against a server that stops answering', () => {
      it('drops the write rather than waiting the driver out', async () => {
        model.create.mockReturnValue(NEVER_ANSWERS);

        await expect(repository.record(ENTRY)).resolves.toBe(false);
      });

      // The same outage as a disconnected store, so the same one line: a hung
      // Mongo would otherwise warn once per conversion for as long as it hangs.
      it('reports the outage once rather than once per conversion', async () => {
        model.create.mockReturnValue(NEVER_ANSWERS);

        await repository.record(ENTRY);
        await repository.record(ENTRY);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          { err: undefined },
          'MongoDB is not connected, conversions are answered but not recorded',
        );
      });

      it('answers a read with the documented outage', async () => {
        query.exec.mockReturnValue(NEVER_ANSWERS);

        await expect(repository.findRecent(10)).rejects.toBeInstanceOf(
          HistoryUnavailableError,
        );
      });

      it('names the deadline as the reason', async () => {
        query.exec.mockReturnValue(NEVER_ANSWERS);

        await expect(repository.findRecent(10)).rejects.toMatchObject({
          details: { reason: 'timeout' },
        });
      });

      // The store coming back is what closes the outage, and the write is what
      // proves it: the deadline must not leave the flag stuck.
      it('records again once the server answers', async () => {
        model.create.mockReturnValue(NEVER_ANSWERS);
        await repository.record(ENTRY);

        model.create.mockResolvedValue(STORED);
        await repository.record(ENTRY);

        expect(logger.info).toHaveBeenCalledWith(
          'MongoDB is reachable again, conversions are being recorded',
        );
      });
    });
  });

  describe('with the connection not ready', () => {
    it('skips the write without touching the driver', async () => {
      await expect(repository.record(ENTRY)).resolves.toBe(false);

      expect(model.create).not.toHaveBeenCalled();
    });

    // A burst while Mongo is down would otherwise write a warning per request
    // and bury the one line that says what is wrong.
    it('warns once for the outage rather than once per conversion', async () => {
      await repository.record(ENTRY);
      await repository.record(ENTRY);
      await repository.record(ENTRY);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        { err: undefined },
        'MongoDB is not connected, conversions are answered but not recorded',
      );
    });

    it('reports the recovery and records again', async () => {
      await repository.record(ENTRY);
      connection.settle();
      await repository.record(ENTRY);

      expect(logger.info).toHaveBeenCalledWith(
        'MongoDB is reachable again, conversions are being recorded',
      );
      expect(model.create).toHaveBeenCalledTimes(1);
    });

    // A connection that is up again is not evidence that a conversion would be
    // recorded, and "conversions are being recorded" is a sentence about the
    // write path: answering /history must not be what says it.
    it('does not announce the write path recovering when only a read ran', async () => {
      await repository.record(ENTRY);
      connection.settle();

      await repository.findRecent(10);

      expect(logger.info).not.toHaveBeenCalled();
    });

    it('answers a read with the typed outage rather than an empty page', async () => {
      await expect(repository.findRecent(10)).rejects.toBeInstanceOf(
        HistoryUnavailableError,
      );
    });

    it('names the reason in the error it throws', async () => {
      await expect(repository.findRecent(10)).rejects.toMatchObject({
        details: { reason: 'connection not ready' },
      });
    });

    // Waiting for the driver to give up looking for a server is the timeout a
    // conversion must never pay.
    it('never asks the driver for a query it cannot serve', async () => {
      await expect(repository.findRecent(10)).rejects.toBeInstanceOf(
        HistoryUnavailableError,
      );

      expect(model.find).not.toHaveBeenCalled();
    });
  });
});
