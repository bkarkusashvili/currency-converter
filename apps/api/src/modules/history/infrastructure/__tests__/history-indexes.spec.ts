import { Model } from 'mongoose';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { FakeMongoConnection } from '../../../../infrastructure/mongo/__tests__/fake-mongo-connection';
import { ConversionRecordDocument } from '../../schemas/conversion-record.schema';
import { HistoryIndexes } from '../history-indexes.provider';

interface ModelDouble {
  syncIndexes: jest.Mock;
}

// The sync is started without being awaited, the way a bootstrap hook has to.
function settled(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('HistoryIndexes', () => {
  let connection: FakeMongoConnection;
  let logger: FakePinoLogger;
  let model: ModelDouble;
  let indexes: HistoryIndexes;

  beforeEach(() => {
    connection = new FakeMongoConnection();
    logger = createFakePinoLogger();
    model = { syncIndexes: jest.fn().mockResolvedValue([]) };
    indexes = new HistoryIndexes(
      model as unknown as Model<ConversionRecordDocument>,
      connection.asConnection(),
      logger.asPinoLogger(),
    );
  });

  // The connection is still opening when the app finishes booting, which is
  // exactly when mongoose's own automatic build would run and be swallowed.
  it('waits for the connection rather than building against one that is opening', () => {
    indexes.onApplicationBootstrap();

    expect(model.syncIndexes).not.toHaveBeenCalled();
  });

  it('reconciles the indexes once the connection is open', async () => {
    indexes.onApplicationBootstrap();
    connection.settle();
    await settled();

    expect(model.syncIndexes).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Conversion history indexes are in place',
    );
  });

  // A retry can get there first, and then no further event is coming.
  it('reconciles them at once when the connection is already open', async () => {
    connection.settle();

    indexes.onApplicationBootstrap();
    await settled();

    expect(model.syncIndexes).toHaveBeenCalledTimes(1);
  });

  it('reconciles them again after the connection comes back', async () => {
    indexes.onApplicationBootstrap();
    connection.settle();
    connection.goesDown();
    connection.settle();
    await settled();

    expect(model.syncIndexes).toHaveBeenCalledTimes(2);
  });

  // The TTL not being in place costs an unbounded collection, not an outage.
  it('reports a failure instead of taking the boot down with it', async () => {
    model.syncIndexes.mockRejectedValue(new Error('not authorized'));

    indexes.onApplicationBootstrap();
    connection.settle();

    await expect(settled()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) as Error },
      expect.stringContaining('will not expire'),
    );
  });
});
