import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../../config/__tests__/fake-config';
import { MongoConnection } from '../mongo-connection';
import { FakeMongoConnection } from './fake-mongo-connection';

// Longer than the retry delay the module is built around, so the test does not
// encode the constant it is checking the effect of.
const PAST_ANY_RETRY_MS = 60_000;

const config = fakeConfig({
  MONGO_URL: 'mongodb://localhost:27017/currency_converter',
  MONGO_SERVER_SELECTION_TIMEOUT_MS: 3000,
});

function createConnection(connection: FakeMongoConnection): {
  lifecycle: MongoConnection;
  logger: FakePinoLogger;
} {
  const logger = createFakePinoLogger();
  const lifecycle = new MongoConnection(
    connection.asConnection(),
    config,
    logger.asPinoLogger(),
  );

  lifecycle.onModuleInit();

  return { lifecycle, logger };
}

describe('MongoConnection', () => {
  describe('against a reachable mongo', () => {
    it('reports the connection once it is open', () => {
      const connection = new FakeMongoConnection();
      const { logger } = createConnection(connection);

      connection.settle();

      expect(logger.info).toHaveBeenCalledWith(
        'MongoDB connection established',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('reports a connection that was already open before it was watched', () => {
      const connection = new FakeMongoConnection();
      connection.settle();

      const { logger } = createConnection(connection);

      expect(logger.info).toHaveBeenCalledWith(
        'MongoDB connection established',
      );
    });
  });

  describe('against a mongo that is down', () => {
    it('does not fail boot', () => {
      const connection = new FakeMongoConnection({ unreachable: true });

      expect(() => createConnection(connection)).not.toThrow();
      expect(() => connection.settle()).not.toThrow();
    });

    it('warns once for the outage rather than once per attempt', () => {
      jest.useFakeTimers();

      try {
        const connection = new FakeMongoConnection({ unreachable: true });
        const { logger } = createConnection(connection);

        connection.settle();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.anything(),
          'MongoDB is unavailable, the conversion history is degraded',
        );
        // The reason every failed attempt carries stays readable without
        // repeating the warning for as long as the outage lasts.
        expect(logger.debug).toHaveBeenCalledWith(
          { err: expect.any(Error) as Error },
          expect.any(String),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    // The failure that leaves no event behind: the factory starts connecting
    // before this module attaches its listeners, and a fast enough failure —
    // DNS, TLS — is over by then. Mongoose drops the `error` nothing was
    // listening for and emits no `disconnected` for a first attempt, so reading
    // the state is the only way the outage is ever noticed.
    it('reports an outage that finished before it started watching', () => {
      const connection = new FakeMongoConnection();
      connection.failsBeforeAnyoneWatches();

      const { logger } = createConnection(connection);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'MongoDB is unavailable, the conversion history is degraded',
      );
    });

    // Reporting it is half the point; the report is what arms the retry, and
    // without it the history would stay down until the next deploy.
    it('retries an outage that finished before it started watching', () => {
      jest.useFakeTimers();

      try {
        const connection = new FakeMongoConnection();
        connection.failsBeforeAnyoneWatches();

        const { logger } = createConnection(connection);

        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);
        expect(connection.openCalls).toBeGreaterThan(0);

        connection.comesBack();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);

        expect(logger.info).toHaveBeenCalledWith(
          'MongoDB connection established',
        );
      } finally {
        jest.useRealTimers();
      }
    });

    // Mongoose retries a connection it has opened before and not one that never
    // opened, so without this the history would stay down until the next deploy
    // because Mongo happened to be starting when the API was.
    it('keeps retrying until the server answers', () => {
      jest.useFakeTimers();

      try {
        const connection = new FakeMongoConnection({ unreachable: true });
        const { logger } = createConnection(connection);

        connection.settle();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);
        expect(connection.openCalls).toBeGreaterThan(1);

        connection.comesBack();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);

        expect(logger.info).toHaveBeenCalledWith(
          'MongoDB connection established',
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('stops retrying once the connection is back', () => {
      jest.useFakeTimers();

      try {
        const connection = new FakeMongoConnection({ unreachable: true });
        createConnection(connection);

        connection.settle();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);
        connection.comesBack();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);

        const opened = connection.openCalls;
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);

        expect(connection.openCalls).toBe(opened);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // An established connection that drops is the driver's to restore; opening a
  // second one over the top of it would leak the first.
  describe('when an open connection drops', () => {
    it('leaves the recovery to the driver', () => {
      jest.useFakeTimers();

      try {
        const connection = new FakeMongoConnection();
        const { logger } = createConnection(connection);

        connection.settle();
        connection.goesDown();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);

        expect(connection.openCalls).toBe(0);
        expect(logger.warn).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('reports the reconnection the driver makes', () => {
      const connection = new FakeMongoConnection();
      const { logger } = createConnection(connection);

      connection.settle();
      connection.goesDown();
      connection.settle();

      expect(logger.info).toHaveBeenCalledWith('MongoDB connection restored');
    });
  });

  describe('shutdown', () => {
    it('closes the connection', async () => {
      const connection = new FakeMongoConnection();
      const { lifecycle } = createConnection(connection);

      connection.settle();
      await lifecycle.onModuleDestroy();

      expect(connection.closeCalls).toBe(1);
    });

    // The close itself disconnects, and a shutdown is not an outage.
    it('does not warn about the disconnect it caused', async () => {
      const connection = new FakeMongoConnection();
      const { lifecycle, logger } = createConnection(connection);

      connection.settle();
      await lifecycle.onModuleDestroy();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('never reopens a connection after the process has started shutting down', async () => {
      jest.useFakeTimers();

      try {
        const connection = new FakeMongoConnection({ unreachable: true });
        const { lifecycle } = createConnection(connection);

        connection.settle();
        await lifecycle.onModuleDestroy();
        jest.advanceTimersByTime(PAST_ANY_RETRY_MS);

        expect(connection.openCalls).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
