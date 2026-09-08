import { Model, Types } from 'mongoose';
import { HistoryUnavailableError } from '../../../../common/errors/history-unavailable.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { FakeMongoConnection } from '../../../../infrastructure/mongo/__tests__/fake-mongo-connection';
import { NewConversionRecord } from '../../domain/conversion-record';
import { ConversionRecordDocument } from '../../schemas/conversion-record.schema';
import { MongoHistoryRepository } from '../mongo-history.repository';

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

const STORED_ID = new Types.ObjectId('6f0000000000000000000001');
const CREATED_AT = new Date('2026-09-08T12:00:05.000Z');

const STORED = { ...ENTRY, _id: STORED_ID, createdAt: CREATED_AT };

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
      await repository.record(ENTRY);

      expect(model.create).toHaveBeenCalledWith(ENTRY);
    });

    it('reads the most recent records first, no more than asked for', async () => {
      await repository.findRecent(5);

      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(query.limit).toHaveBeenCalledWith(5);
      expect(query.lean).toHaveBeenCalled();
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
          strategy: 'cross',
          source: 'cache',
          ratesTimestamp: '2026-09-08T12:00:00.000Z',
          createdAt: CREATED_AT.toISOString(),
        },
      ]);
    });

    // The record is not part of the answer: a write that fails costs a log line
    // and nothing else.
    it('swallows a write that fails, with the reason', async () => {
      model.create.mockRejectedValue(new Error('E11000 duplicate key'));

      await expect(repository.record(ENTRY)).resolves.toBeUndefined();
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
  });

  describe('with the connection not ready', () => {
    it('skips the write without touching the driver', async () => {
      await expect(repository.record(ENTRY)).resolves.toBeUndefined();

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
