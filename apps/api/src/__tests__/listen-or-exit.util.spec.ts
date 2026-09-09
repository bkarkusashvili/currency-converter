import { INestApplication, Logger } from '@nestjs/common';
import { listenOrExit } from '../listen-or-exit.util';

// Declared as properties rather than by implementing INestApplication: a
// jest.Mock read off a method signature is what the unbound-method rule exists
// to catch, and only these two are reached.
interface AppDouble {
  listen: jest.Mock;
  close: jest.Mock;
  flushLogs: jest.Mock;
}

function addressInUse(port: number): Error {
  return Object.assign(
    new Error(`listen EADDRINUSE: address already in use 0.0.0.0:${port}`),
    { code: 'EADDRINUSE' },
  );
}

describe('listenOrExit', () => {
  let app: AppDouble;
  let error: jest.SpyInstance;
  let exit: jest.SpyInstance;

  beforeEach(() => {
    app = {
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      flushLogs: jest.fn(),
    };
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    exit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as unknown as typeof process.exit);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function listen(port = 3000): Promise<void> {
    await listenOrExit(app as unknown as INestApplication, port);
  }

  describe('when the port is free', () => {
    it('listens on every interface at the port it was given', async () => {
      await listen(8080);

      expect(app.listen).toHaveBeenCalledWith(8080, '0.0.0.0');
    });

    it('leaves the process running', async () => {
      await listen();

      expect(exit).not.toHaveBeenCalled();
      expect(app.close).not.toHaveBeenCalled();
    });

    // Nest flushes them itself from inside listen's success callback.
    it('leaves the buffered startup logs to Nest', async () => {
      await listen();

      expect(app.flushLogs).not.toHaveBeenCalled();
    });
  });

  describe('when the port is already in use', () => {
    beforeEach(() => {
      app.listen.mockRejectedValue(addressInUse(3000));
    });

    // Nest only empties the `bufferLogs` buffer when listen succeeds, so
    // without this the adapter's own EADDRINUSE line — and the line below —
    // are written into a buffer nothing ever reads.
    it('releases the logs the failed startup buffered', async () => {
      await listen();

      expect(app.flushLogs).toHaveBeenCalled();
    });

    // The port is the whole diagnosis, so it is in the message rather than only
    // in the stack the driver happened to write.
    it('names the port at error level', async () => {
      await listen(3000);

      expect(error).toHaveBeenCalledWith(
        'Cannot listen on port 3000',
        expect.stringContaining('EADDRINUSE'),
      );
    });

    it('exits non-zero rather than leaving a process with no listener', async () => {
      await listen();

      expect(exit).toHaveBeenCalledWith(1);
    });

    // ioredis holds the event loop open, so setting an exit code would never be
    // reached; closing releases it and runs the shutdown hooks first.
    it('closes the app before it exits', async () => {
      await listen();

      expect(app.close.mock.invocationCallOrder[0]).toBeLessThan(
        exit.mock.invocationCallOrder[0]!,
      );
    });

    it('still exits when the app cannot be closed', async () => {
      app.close.mockRejectedValue(new Error('a shutdown hook threw'));

      await listen();

      expect(exit).toHaveBeenCalledWith(1);
    });

    it('reports a rejection that is not an Error', async () => {
      app.listen.mockRejectedValue('the socket went away');

      await listen(3000);

      expect(error).toHaveBeenCalledWith(
        'Cannot listen on port 3000',
        'the socket went away',
      );
    });
  });
});
