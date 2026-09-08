import { HistoryUnavailableError } from '../../../common/errors/history-unavailable.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../common/logging/__tests__/fake-pino-logger';
import { ConversionRecord } from '../domain/conversion-record';
import type { NewConversionRecord } from '../domain/conversion-record';
import { HistoryService } from '../history.service';

// Exactly what a conversion answers, which is why the service can take the
// port's type and the conversion module can hand over its result unchanged.
const RESULT: NewConversionRecord = {
  from: 'EUR',
  to: 'GBP',
  amount: 100,
  result: 85.09,
  rate: 0.850942,
  strategy: 'cross',
  source: 'cache',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
};

const RECORD: ConversionRecord = {
  ...RESULT,
  id: '6f0000000000000000000001',
  createdAt: '2026-09-08T12:00:05.000Z',
};

// Declared as properties rather than by extending the port: a jest.Mock read
// off a method signature is what the unbound-method rule exists to catch.
interface RepositoryDouble {
  record: jest.Mock;
  findRecent: jest.Mock;
}

describe('HistoryService', () => {
  let repository: RepositoryDouble;
  let logger: FakePinoLogger;
  let service: HistoryService;

  beforeEach(() => {
    repository = {
      record: jest.fn().mockResolvedValue(undefined),
      findRecent: jest.fn().mockResolvedValue([RECORD]),
    };
    logger = createFakePinoLogger();
    service = new HistoryService(repository, logger.asPinoLogger());
  });

  describe('record', () => {
    it('stores the conversion as it was answered', async () => {
      await service.record(RESULT);

      expect(repository.record).toHaveBeenCalledWith(RESULT);
    });

    // The conversion is the answer and the record is a side effect of it: a
    // repository that breaks the port's promise must not turn a priced
    // conversion into a 500.
    it('resolves even when the repository rejects', async () => {
      repository.record.mockRejectedValue(new Error('write concern failed'));

      await expect(service.record(RESULT)).resolves.toBeUndefined();
    });

    it('reports the write that escaped, with the reason', async () => {
      repository.record.mockRejectedValue(new Error('write concern failed'));

      await service.record(RESULT);

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        expect.stringContaining('the conversion is unaffected'),
      );
    });
  });

  describe('recent', () => {
    it('answers with the records the repository holds', async () => {
      await expect(service.recent(10)).resolves.toStrictEqual([RECORD]);
    });

    it('asks for no more than the caller wanted', async () => {
      await service.recent(3);

      expect(repository.findRecent).toHaveBeenCalledWith(3);
    });

    it('keeps the outage the repository already reported', async () => {
      repository.findRecent.mockRejectedValue(
        new HistoryUnavailableError({ reason: 'connection not ready' }),
      );

      await expect(service.recent(10)).rejects.toMatchObject({
        details: { reason: 'connection not ready' },
      });
    });

    it('turns any other failure into the documented outage', async () => {
      repository.findRecent.mockRejectedValue(new Error('cursor killed'));

      await expect(service.recent(10)).rejects.toBeInstanceOf(
        HistoryUnavailableError,
      );
    });

    // A driver message names the host and, with a password in the url, the
    // credentials; the envelope this becomes is served to the client.
    it('never lets the driver message reach the error it throws', async () => {
      repository.findRecent.mockRejectedValue(
        new Error(
          'failed to connect to mongodb://admin:hunter2@10.0.0.4:27017',
        ),
      );

      const failure = await service
        .recent(10)
        .catch((error: HistoryUnavailableError) => error);

      expect(JSON.stringify(failure)).not.toContain('hunter2');
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        'Conversion history read failed',
      );
    });
  });
});
