import { RatesUnavailableError } from '../../../../common/errors/rates-unavailable.error';
import { fakeConfig } from '../../../../config/__tests__/fake-config';
import { CircuitOpenError } from '../../../../common/resilience/circuit-open.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { CachedSnapshot } from '../../domain/rates-repository.interface';
import { ArchivedSnapshot } from '../../domain/rate-history.types';
import { RatesSnapshot } from '../../domain/exchange-rate.types';
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

interface ArchiveDouble {
  save: jest.Mock;
  findLatest: jest.Mock;
  findPairWindow: jest.Mock;
}

// How old the newest archived day may be and still price an answer.
const MAX_AGE_DAYS = 7;

// Dated against the clock rather than pinned: the tier now refuses a day past
// the ceiling, so a fixed date would fall outside it the day after it was
// written. Read once, so a suite that starts at 23:59:59 dates every fixture
// from the same day.
const TODAY = Date.now();

function daysAgo(days: number): string {
  return new Date(TODAY - days * 86_400_000).toISOString().slice(0, 10);
}

// Days older than the stale key by construction: the archive is what is left
// when the fallback has expired too.
function archived(days: number): ArchivedSnapshot {
  const date = daysAgo(days);

  return {
    date,
    fetchedAt: `${date}T12:00:00.000Z`,
    rates: [
      { base: 'USD', quote: 'UAH', buy: 41.9, date: `${date}T11:00:00.000Z` },
    ],
  };
}

const ARCHIVED = archived(1);

describe('RatesService', () => {
  let provider: ProviderDouble;
  let repository: RepositoryDouble;
  let archive: ArchiveDouble;
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
    archive = {
      save: jest.fn().mockResolvedValue(true),
      findLatest: jest.fn().mockResolvedValue(null),
      findPairWindow: jest.fn().mockResolvedValue([]),
    };
    logger = createFakePinoLogger();
    service = new RatesService(
      provider,
      repository,
      archive,
      fakeConfig({ RATES_ARCHIVE_FALLBACK_MAX_AGE_DAYS: MAX_AGE_DAYS }),
      logger.asPinoLogger(),
    );
  });

  describe('on a cache hit', () => {
    it('answers from the cache without reaching the upstream', async () => {
      repository.getFresh.mockResolvedValue(hit(FRESH));

      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: FRESH,
        source: 'cache',
        cacheDegraded: false,
        archiveDegraded: false,
      });

      expect(provider.fetchRates).not.toHaveBeenCalled();
    });

    // The tiers below it are not reached either, and each is a store this would
    // otherwise be paying for on the one path that should touch nothing: the
    // fallback key, and the archive behind it.
    it('reaches no tier below the fresh key', async () => {
      repository.getFresh.mockResolvedValue(hit(FRESH));

      await service.getSnapshot();

      expect(repository.getStale).not.toHaveBeenCalled();
      expect(archive.findLatest).not.toHaveBeenCalled();
    });
  });

  describe('on a cache miss', () => {
    it('fetches, caches and reports the provider as the source', async () => {
      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: FRESH,
        source: 'provider',
        cacheDegraded: false,
        archiveDegraded: false,
      });

      expect(repository.save).toHaveBeenCalledWith(FRESH);
      expect(archive.save).toHaveBeenCalledWith(FRESH);
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
        archiveDegraded: false,
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
        archiveDegraded: false,
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

  // The fourth tier (§4): older than the fallback key by construction, and the
  // last thing between an upstream outage that outlived both cache keys and a
  // 503.
  describe('when the upstream fails and both cache keys have expired', () => {
    beforeEach(() => {
      provider.fetchRates.mockRejectedValue(new Error('upstream down'));
    });

    it('serves the newest archived day and says where it came from', async () => {
      archive.findLatest.mockResolvedValue(ARCHIVED);

      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: { fetchedAt: ARCHIVED.fetchedAt, rates: ARCHIVED.rates },
        source: 'archive',
        cacheDegraded: false,
        archiveDegraded: false,
      });
    });

    // Days old and priced against a market that has moved: the operator hears
    // about this one.
    it('warns that it is answering from the archive', async () => {
      archive.findLatest.mockResolvedValue(ARCHIVED);

      await service.getSnapshot();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('archived rates') as string,
      );
    });

    it('is reached only after the stale key has been tried', async () => {
      repository.getStale.mockResolvedValue(hit(STALE));
      archive.findLatest.mockResolvedValue(ARCHIVED);

      await expect(service.getSnapshot()).resolves.toMatchObject({
        source: 'stale-cache',
      });

      expect(archive.findLatest).not.toHaveBeenCalled();
    });

    it('fails with the documented error when the archive is empty too', async () => {
      await expect(service.getSnapshot()).rejects.toBeInstanceOf(
        RatesUnavailableError,
      );
    });

    // The retention is how far back the chart goes; it is not a statement about
    // what may price a conversion. Left uncapped this tier answers 200 from a
    // 90-day-old rate that reads like any other answer.
    describe('and the newest archived day is past the fallback ceiling', () => {
      beforeEach(() => {
        archive.findLatest.mockResolvedValue(archived(MAX_AGE_DAYS + 1));
      });

      it('declines rather than pricing from it', async () => {
        await expect(service.getSnapshot()).rejects.toBeInstanceOf(
          RatesUnavailableError,
        );
      });

      // The reason travels to the client in the envelope, so it is the API's
      // own vocabulary — the resilience decision and two numbers — and carries
      // no upstream or driver message.
      it('says how old the day was and what the ceiling is', async () => {
        await expect(service.getSnapshot()).rejects.toMatchObject({
          details: {
            reason:
              `upstream request failed; the newest archived rates are ` +
              `${MAX_AGE_DAYS + 1} days old, past the ${MAX_AGE_DAYS} day ` +
              `fallback ceiling`,
          },
        });
      });

      it('never carries the upstream message into the reason', async () => {
        provider.fetchRates.mockRejectedValue(
          new Error('connect ECONNREFUSED api.monobank.ua:443'),
        );

        await expect(service.getSnapshot()).rejects.not.toThrow(/monobank\.ua/);
      });
    });

    // The ceiling is a maximum age, not a range that excludes its own bound: a
    // day exactly that old is the oldest one this still prices from.
    it('serves an archived day that is exactly at the ceiling', async () => {
      archive.findLatest.mockResolvedValue(archived(MAX_AGE_DAYS));

      await expect(service.getSnapshot()).resolves.toMatchObject({
        source: 'archive',
      });
    });

    // The client is already being told the rates are unavailable and why. An
    // archive that cannot be read is a fallback with nothing in it, not a
    // second failure to report — ARCHIVE_UNAVAILABLE is /rates/history's answer.
    it('treats an unreadable archive as an empty one', async () => {
      archive.findLatest.mockRejectedValue(new Error('mongo is gone'));

      await expect(service.getSnapshot()).rejects.toMatchObject({
        details: { reason: 'upstream request failed' },
      });

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('when the archive cannot take the snapshot', () => {
    it('serves the rates and reports the day that was dropped', async () => {
      archive.save.mockResolvedValue(false);

      await expect(service.getSnapshot()).resolves.toStrictEqual({
        snapshot: FRESH,
        source: 'provider',
        cacheDegraded: false,
        archiveDegraded: true,
      });
    });

    // Nothing was fetched, so there was nothing to archive: reporting the
    // archive as degraded on a hit would warn about a write that never was.
    it('says nothing about the archive on a cache hit', async () => {
      repository.getFresh.mockResolvedValue(hit(FRESH));

      await expect(service.getSnapshot()).resolves.toMatchObject({
        archiveDegraded: false,
      });

      expect(archive.save).not.toHaveBeenCalled();
    });

    it('says nothing about the archive on a stale answer', async () => {
      provider.fetchRates.mockRejectedValue(new Error('upstream down'));
      repository.getStale.mockResolvedValue(hit(STALE));

      await expect(service.getSnapshot()).resolves.toMatchObject({
        source: 'stale-cache',
        archiveDegraded: false,
      });
    });

    // The two stores fail independently and are reported independently: a
    // client that sees only CACHE_UNAVAILABLE knows the archive took the day.
    it('reports the two stores separately', async () => {
      repository.save.mockResolvedValue({ degraded: true });

      await expect(service.getSnapshot()).resolves.toMatchObject({
        cacheDegraded: true,
        archiveDegraded: false,
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
