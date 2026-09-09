import { ArchiveUnavailableError } from '../../../../common/errors/archive-unavailable.error';
import { UnsupportedCurrencyError } from '../../../../common/errors/unsupported-currency.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { InMemoryRatesArchive } from '../../__tests__/in-memory-rates-archive.repository';
import { ArchivedSnapshot } from '../../domain/rate-history.types';
import { RateHistoryService } from '../rate-history.service';

// Dated relative to the clock rather than pinned: the window the port applies
// is "today and the days before it", so a fixed date would leave the archive
// outside every window the moment the suite is run again.
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function day(date: string, buy: number): ArchivedSnapshot {
  return {
    date,
    fetchedAt: `${date}T23:00:00.000Z`,
    rates: [
      {
        base: 'USD',
        quote: 'UAH',
        buy,
        sell: buy + 0.5,
        date: `${date}T22:00:00.000Z`,
      },
    ],
  };
}

describe('RateHistoryService', () => {
  let logger: FakePinoLogger;

  function build(archive: InMemoryRatesArchive): RateHistoryService {
    return new RateHistoryService(archive, logger.asPinoLogger());
  }

  beforeEach(() => {
    logger = createFakePinoLogger();
  });

  it('echoes the pair and the window it was asked for', async () => {
    const service = build(
      new InMemoryRatesArchive({ seed: [day(daysAgo(1), 44.2)] }),
    );

    await expect(
      service.series({ base: 'USD', quote: 'UAH', days: 7 }),
    ).resolves.toMatchObject({ base: 'USD', quote: 'UAH', days: 7 });
  });

  it('answers the archived days oldest first', async () => {
    const service = build(
      new InMemoryRatesArchive({
        seed: [day(daysAgo(2), 44.1), day(daysAgo(1), 44.2)],
      }),
    );

    const { points } = await service.series({
      base: 'USD',
      quote: 'UAH',
      days: 7,
    });

    expect(points.map((point) => point.buy)).toStrictEqual([44.1, 44.2]);
  });

  // The window is what makes a chart a chart: a day outside it is not a shorter
  // answer, it is a different question.
  it('trims the series to the window that was asked for', async () => {
    const service = build(
      new InMemoryRatesArchive({
        seed: [day(daysAgo(5), 43.9), day(daysAgo(1), 44.2)],
      }),
    );

    const { points } = await service.series({
      base: 'USD',
      quote: 'UAH',
      days: 2,
    });

    expect(points).toHaveLength(1);
    expect(points[0]?.buy).toBe(44.2);
  });

  it('lets the aggregation reject a code the archive never quoted', async () => {
    const service = build(
      new InMemoryRatesArchive({ seed: [day(daysAgo(1), 44.2)] }),
    );

    await expect(
      service.series({ base: 'XYZ', quote: 'UAH', days: 7 }),
    ).rejects.toBeInstanceOf(UnsupportedCurrencyError);
  });

  // A driver message carries the connection string with the credentials in it,
  // so every failure becomes the one documented outage rather than a 500.
  describe('when the archive cannot be read', () => {
    const driverFailure = new Error(
      'failed to connect to server mongodb://admin:hunter2@10.0.0.4:27017',
    );

    it('answers the documented outage', async () => {
      const service = build(
        new InMemoryRatesArchive({ failsWith: driverFailure }),
      );

      await expect(
        service.series({ base: 'USD', quote: 'UAH', days: 7 }),
      ).rejects.toMatchObject({ details: { reason: 'read failed' } });
    });

    it('never carries the driver message into the error', async () => {
      const service = build(
        new InMemoryRatesArchive({ failsWith: driverFailure }),
      );

      await expect(
        service.series({ base: 'USD', quote: 'UAH', days: 7 }),
      ).rejects.not.toThrow(/hunter2/);
      expect(logger.error).toHaveBeenCalled();
    });

    // The adapter already decided which outage it was and why; rewrapping it
    // would replace `timeout` with `read failed` and lose the difference.
    it('keeps the reason the adapter named', async () => {
      const service = build(
        new InMemoryRatesArchive({
          failsWith: new ArchiveUnavailableError({ reason: 'timeout' }),
        }),
      );

      await expect(
        service.series({ base: 'USD', quote: 'UAH', days: 7 }),
      ).rejects.toMatchObject({ details: { reason: 'timeout' } });
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
