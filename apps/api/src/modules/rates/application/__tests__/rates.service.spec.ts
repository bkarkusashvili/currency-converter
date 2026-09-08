import { RatesUnavailableError } from '../../../../common/errors/rates-unavailable.error';
import { CircuitOpenError } from '../../../../common/resilience/circuit-open.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { CachedSnapshot } from '../../domain/cache-outcome';
import { RatesSnapshot } from '../../domain/rates-snapshot';
import { RatesService } from '../rates.service';

const FRESH: RatesSnapshot = {
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    { base: 'USD', quote: 'UAH', buy: 44.35, date: '2026-09-08T11:00:00.000Z' },
  ],
};

const STALE: RatesSnapshot = {
  fetchedAt: '2026-09-07T12:00:00.000Z',
  rates: [
    { base: 'USD', quote: 'UAH', buy: 43.1, date: '2026-09-07T11:00:00.000Z' },
  ],
};

// Declared as properties rather than by extending the ports: a jest.Mock read
// off a method signature is what the unbound-method rule exists to catch.
interface ProviderDouble {
  fetchRates: jest.Mock;
}

// The two ways the cache answers with no snapshot, which the service reports
// differently: an expiry costs an upstream call, an outage costs one and is
// reported to the client.
const miss = (): CachedSnapshot => ({ snapshot: null, degraded: false });
const unreachable = (): CachedSnapshot => ({ snapshot: null, degraded: true });
const hit = (snapshot: RatesSnapshot): CachedSnapshot => ({
  snapshot,
  degraded: false,
});

interface RepositoryDouble {
  getFresh: jest.Mock;
  getStale: jest.Mock;
  save: jest.Mock;
  clear: jest.Mock;
}

describe('RatesService', () => {
  let provider: ProviderDouble;
  let repository: RepositoryDouble;
  let logger: FakePinoLogger;
  let service: RatesService;

  beforeEach(() => {
    provider = { fetchRates: jest.fn().mockResolvedValue(FRESH) };
    repository = {
      getFresh: jest.fn().mockResolvedValue(miss()),
      getStale: jest.fn().mockResolvedValue(miss()),
      save: jest.fn().mockResolvedValue({ degraded: false }),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    logger = createFakePinoLogger();
    service = new RatesService(provider, repository, logger.asPinoLogger());
  });

  describe('on a cache hit', () => {
    it('answers from the cache without reaching the upstream', async () => {
      repository.getFresh.mockResolvedValue(hit(FRESH));

      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: FRESH,
        source: 'cache',
        cacheDegraded: false,
      });

      expect(provider.fetchRates).not.toHaveBeenCalled();
    });
  });

  describe('on a cache miss', () => {
    it('fetches, caches and reports the provider as the source', async () => {
      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: FRESH,
        source: 'provider',
        cacheDegraded: false,
      });

      expect(repository.save).toHaveBeenCalledWith(FRESH);
    });

    it('serves concurrent callers from one upstream call', async () => {
      const [first, second, third] = await Promise.all([
        service.getSnapshot(),
        service.getSnapshot(),
        service.getSnapshot(),
      ]);

      expect(provider.fetchRates).toHaveBeenCalledTimes(1);
      expect(first).toStrictEqual(second);
      expect(third.source).toBe('provider');
    });

    it('fetches again on the next miss once the flight has landed', async () => {
      await service.getSnapshot();
      await service.getSnapshot();

      expect(provider.fetchRates).toHaveBeenCalledTimes(2);
    });

    it('does not strand the next caller behind a failed flight', async () => {
      provider.fetchRates
        .mockRejectedValueOnce(new Error('upstream down'))
        .mockResolvedValue(FRESH);

      await expect(service.getSnapshot()).rejects.toBeInstanceOf(
        RatesUnavailableError,
      );

      await expect(service.getSnapshot()).resolves.toMatchObject({
        source: 'provider',
      });
    });
  });

  describe('when the upstream fails', () => {
    beforeEach(() => {
      provider.fetchRates.mockRejectedValue(new Error('upstream down'));
    });

    it('falls back to the stale copy and warns', async () => {
      repository.getStale.mockResolvedValue(hit(STALE));

      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: STALE,
        source: 'stale-cache',
        cacheDegraded: false,
      });

      expect(logger.warn).toHaveBeenCalled();
    });

    it('fails with the documented error when there is no stale copy', async () => {
      await expect(service.getSnapshot()).rejects.toBeInstanceOf(
        RatesUnavailableError,
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('never leaks the upstream failure into the envelope', async () => {
      provider.fetchRates.mockRejectedValue(
        new Error('connect ECONNREFUSED api.monobank.ua:443'),
      );

      await expect(service.getSnapshot()).rejects.toMatchObject({
        details: { reason: 'upstream request failed' },
      });
    });

    it('reports an open circuit as its own reason', async () => {
      provider.fetchRates.mockRejectedValue(new CircuitOpenError());

      await expect(service.getSnapshot()).rejects.toMatchObject({
        details: { reason: 'upstream circuit open' },
      });
    });

    it('falls back to the stale copy when the circuit is open', async () => {
      provider.fetchRates.mockRejectedValue(new CircuitOpenError());
      repository.getStale.mockResolvedValue(hit(STALE));

      await expect(service.getSnapshot()).resolves.toMatchObject({
        source: 'stale-cache',
      });
    });
  });

  // The client is told what a request cost it, which until now was only in the
  // log: a cache that could not be reached means the answer was not cached and
  // the next request pays the upstream again.
  describe('when the cache cannot be reached', () => {
    it('reports the read that could not be served', async () => {
      repository.getFresh.mockResolvedValue(unreachable());

      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: FRESH,
        source: 'provider',
        cacheDegraded: true,
      });
    });

    it('reports the write that could not be stored', async () => {
      repository.save.mockResolvedValue({ degraded: true });

      await expect(service.getSnapshot()).resolves.toMatchObject({
        source: 'provider',
        cacheDegraded: true,
      });
    });

    it('reports a fallback read that could not be served either', async () => {
      provider.fetchRates.mockRejectedValue(new Error('upstream down'));
      repository.getFresh.mockResolvedValue(unreachable());
      repository.getStale.mockResolvedValue({
        snapshot: STALE,
        degraded: false,
      });

      await expect(service.getSnapshot()).resolves.toMatchObject({
        source: 'stale-cache',
        cacheDegraded: true,
      });
    });

    // An expiry is not an outage: the request pays an upstream call for it and
    // that is what a cache TTL is for.
    it('says nothing about a key that had simply expired', async () => {
      await expect(service.getSnapshot()).resolves.toMatchObject({
        cacheDegraded: false,
      });
    });
  });

  describe('invalidate', () => {
    it('clears the cache', async () => {
      await service.invalidate();

      expect(repository.clear).toHaveBeenCalledTimes(1);
    });
  });
});
