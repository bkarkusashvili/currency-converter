import { HistoryUnavailableError } from '../../../common/errors/history-unavailable.error';
import { ConversionRecord } from '../domain/conversion-record';
import { DEFAULT_HISTORY_LIMIT } from '../domain/history-limits';
import { HistoryController } from '../history.controller';
import { HistoryService } from '../history.service';

const RECORD: ConversionRecord = {
  id: '6f0000000000000000000001',
  from: 'EUR',
  to: 'GBP',
  amount: 100,
  result: 85.09,
  rate: 0.850942,
  strategy: 'cross',
  source: 'cache',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
  createdAt: '2026-09-08T12:00:05.000Z',
};

// Declared as properties rather than by extending the service: a jest.Mock read
// off a method signature is what the unbound-method rule exists to catch.
interface ServiceDouble {
  recent: jest.Mock;
}

describe('HistoryController', () => {
  let service: ServiceDouble;
  let controller: HistoryController;

  beforeEach(() => {
    service = { recent: jest.fn().mockResolvedValue([RECORD]) };
    controller = new HistoryController(service as unknown as HistoryService);
  });

  it('answers with the records under the documented key', async () => {
    await expect(
      controller.list({ limit: DEFAULT_HISTORY_LIMIT }),
    ).resolves.toStrictEqual({ items: [RECORD] });
  });

  it('passes the validated limit through', async () => {
    await controller.list({ limit: 3 });

    expect(service.recent).toHaveBeenCalledWith(3);
  });

  it('lets the outage through to the exception filter', async () => {
    service.recent.mockRejectedValue(new HistoryUnavailableError());

    await expect(
      controller.list({ limit: DEFAULT_HISTORY_LIMIT }),
    ).rejects.toBeInstanceOf(HistoryUnavailableError);
  });
});
