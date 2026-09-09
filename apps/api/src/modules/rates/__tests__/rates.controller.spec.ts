import { ArchiveUnavailableError } from '../../../common/errors/archive-unavailable.error';
import { CacheUnavailableError } from '../../../common/errors/cache-unavailable.error';
import { RatesLookup } from '../domain/exchange-rate.types';
import { RateHistory } from '../domain/rate-history.types';
import { RateHistoryService } from '../application/rate-history.service';
import { RatesService } from '../application/rates.service';
import { RatesController } from '../rates.controller';
import { RatesSource } from '../domain/rates-source.enum';

const LOOKUP: RatesLookup = {
  source: RatesSource.Cache,
  cacheDegraded: false,
  archiveDegraded: false,
  snapshot: {
    fetchedAt: '2026-09-08T12:00:00.000Z',
    rates: [
      {
        base: 'USD',
        quote: 'UAH',
        buy: 44.35,
        sell: 44.831,
        date: '2026-09-08T11:00:00.000Z',
      },
    ],
  },
};

const SERIES: RateHistory = {
  base: 'USD',
  quote: 'UAH',
  days: 7,
  points: [
    { date: '2026-09-07', buy: 44.3, sell: 44.79 },
    { date: '2026-09-08', buy: 44.35, sell: 44.831 },
  ],
};

// Declared as properties rather than by extending the service: a jest.Mock
// read off a method signature is what the unbound-method rule exists to catch.
interface ServiceDouble {
  getSnapshot: jest.Mock;
  invalidate: jest.Mock;
}

interface HistoryServiceDouble {
  series: jest.Mock;
}

describe('RatesController', () => {
  let service: ServiceDouble;
  let history: HistoryServiceDouble;
  let controller: RatesController;

  beforeEach(() => {
    service = {
      getSnapshot: jest.fn().mockResolvedValue(LOOKUP),
      invalidate: jest.fn().mockResolvedValue(undefined),
    };
    history = { series: jest.fn().mockResolvedValue(SERIES) };
    controller = new RatesController(
      service as unknown as RatesService,
      history as unknown as RateHistoryService,
    );
  });

  describe('GET /rates', () => {
    it('flattens the lookup into the documented response', async () => {
      await expect(controller.getRates()).resolves.toStrictEqual({
        source: RatesSource.Cache,
        fetchedAt: LOOKUP.snapshot.fetchedAt,
        rates: LOOKUP.snapshot.rates,
      });
    });

    // The source is the whole point of reporting one: a client that cannot
    // tell a fresh answer from a fallback has no reason to be told either.
    it('reports the source the service served the snapshot from', async () => {
      service.getSnapshot.mockResolvedValue({
        ...LOOKUP,
        source: RatesSource.StaleCache,
      });

      await expect(controller.getRates()).resolves.toMatchObject({
        source: RatesSource.StaleCache,
      });
    });

    // The degradation was only ever in the log, so a client had no way to know
    // its answer cost an upstream call and was not cached.
    it('reports a cache that could not be reached as a warning', async () => {
      service.getSnapshot.mockResolvedValue({ ...LOOKUP, cacheDegraded: true });

      await expect(controller.getRates()).resolves.toMatchObject({
        warnings: [
          { code: 'CACHE_UNAVAILABLE', message: expect.any(String) as string },
        ],
      });
    });

    // The flag is raised by a failed read as well as a failed write, so the
    // warning rides on an answer that came out of the stale key rather than out
    // of the upstream. A message that named a provenance would be wrong here,
    // and `source` is the field that has one.
    it('warns without claiming a provenance when a stale answer degraded', async () => {
      service.getSnapshot.mockResolvedValue({
        ...LOOKUP,
        source: RatesSource.StaleCache,
        cacheDegraded: true,
      });

      const response = await controller.getRates();
      const [warning] = response.warnings ?? [];

      expect(response.source).toBe('stale-cache');
      expect(warning?.code).toBe('CACHE_UNAVAILABLE');
      expect(warning?.message).not.toMatch(/upstream|fetch|provider/i);
      expect(warning?.message).toContain('source');
    });

    // The snapshot was fetched and served; what was lost is the day, which the
    // client would otherwise only discover as a gap in /rates/history.
    it('reports a day that could not be archived as a warning', async () => {
      service.getSnapshot.mockResolvedValue({
        ...LOOKUP,
        source: RatesSource.Provider,
        archiveDegraded: true,
      });

      await expect(controller.getRates()).resolves.toMatchObject({
        source: RatesSource.Provider,
        warnings: [
          {
            code: 'ARCHIVE_NOT_RECORDED',
            message: expect.any(String) as string,
          },
        ],
      });
    });

    // Absent rather than empty, so a healthy answer is exactly what it was.
    it('carries no warnings field at all when nothing degraded', async () => {
      const response = await controller.getRates();

      expect(response).not.toHaveProperty('warnings');
    });

    it('lets a service failure through to the exception filter', async () => {
      service.getSnapshot.mockRejectedValue(new Error('rates are gone'));

      await expect(controller.getRates()).rejects.toThrow('rates are gone');
    });
  });

  describe('GET /rates/history', () => {
    it('hands the validated query to the service and answers what it built', async () => {
      const query = { base: 'USD', quote: 'UAH', days: 7 };

      await expect(controller.getHistory(query)).resolves.toStrictEqual(SERIES);

      expect(history.series).toHaveBeenCalledWith(query);
    });

    // The series is the answer and there is nothing about the request left to
    // report on it: the route reads the archive and nothing else.
    it('carries no warnings field', async () => {
      const response = await controller.getHistory({
        base: 'USD',
        quote: 'UAH',
        days: 7,
      });

      expect(response).not.toHaveProperty('warnings');
      expect(service.getSnapshot).not.toHaveBeenCalled();
    });

    it('lets an unreachable archive through to the exception filter', async () => {
      history.series.mockRejectedValue(new ArchiveUnavailableError());

      await expect(
        controller.getHistory({ base: 'USD', quote: 'UAH', days: 7 }),
      ).rejects.toBeInstanceOf(ArchiveUnavailableError);
    });
  });

  describe('DELETE /rates/cache', () => {
    it('asks the service to invalidate and answers with no body', async () => {
      await expect(controller.invalidate()).resolves.toBeUndefined();

      expect(service.invalidate).toHaveBeenCalledTimes(1);
    });

    // A 204 the cache never performed is the one answer this route must not
    // give: the operator is told the keys are gone and the stale rates keep
    // being served.
    it('lets a cache that refused the command through to the filter', async () => {
      service.invalidate.mockRejectedValue(new CacheUnavailableError());

      await expect(controller.invalidate()).rejects.toBeInstanceOf(
        CacheUnavailableError,
      );
    });
  });
});
