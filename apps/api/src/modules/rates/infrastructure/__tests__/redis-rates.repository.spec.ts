import type Redis from 'ioredis';
import { CacheUnavailableError } from '../../../../common/errors/cache-unavailable.error';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../../../config/__tests__/fake-config';
import {
  COMMAND_TIMED_OUT,
  FakeRedisClient,
} from '../../../../infrastructure/redis/__tests__/fake-redis-client';
import { RatesSnapshot } from '../../domain/exchange-rate.types';
import { RATES_CACHE_KEYS } from '../rates-cache-keys.constants';
import { RedisRatesRepository } from '../redis-rates.repository';

const FRESH_TTL_SECONDS = 300;
const STALE_TTL_SECONDS = 86_400;

const SNAPSHOT: RatesSnapshot = {
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
};

const config = fakeConfig({
  RATES_CACHE_TTL_SECONDS: FRESH_TTL_SECONDS,
  RATES_STALE_TTL_SECONDS: STALE_TTL_SECONDS,
});

describe('RedisRatesRepository', () => {
  let client: FakeRedisClient;
  let logger: FakePinoLogger;
  let repository: RedisRatesRepository;

  function build(redis: Redis): RedisRatesRepository {
    return new RedisRatesRepository(redis, config, logger.asPinoLogger());
  }

  beforeEach(async () => {
    client = new FakeRedisClient();
    logger = createFakePinoLogger();
    await client.connect();
    repository = build(client.asRedis());
  });

  describe('save', () => {
    it('writes both keys with the configured expiries', async () => {
      await expect(repository.save(SNAPSHOT)).resolves.toStrictEqual({
        degraded: false,
      });

      expect(client.stored(RATES_CACHE_KEYS.fresh)).toBe(
        JSON.stringify(SNAPSHOT),
      );
      expect(client.stored(RATES_CACHE_KEYS.stale)).toBe(
        JSON.stringify(SNAPSHOT),
      );
      expect(client.ttlOf(RATES_CACHE_KEYS.fresh)).toBe(FRESH_TTL_SECONDS);
      expect(client.ttlOf(RATES_CACHE_KEYS.stale)).toBe(STALE_TTL_SECONDS);
    });

    it('degrades and warns when redis is unreachable', async () => {
      const offline = build(new FakeRedisClient().asRedis());

      await expect(offline.save(SNAPSHOT)).resolves.toStrictEqual({
        degraded: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        expect.stringContaining('save failed'),
      );
    });

    // ioredis reports a command that failed on a live connection as an entry
    // error, so an unchecked exec would call a lost write a success.
    it('warns when a queued command comes back with an error', async () => {
      const rejected = {
        multi: () => {
          const chain = {
            set: () => chain,
            exec: () => Promise.resolve([[new Error('OOM'), null]]),
          };

          return chain;
        },
      } as unknown as Redis;

      await expect(build(rejected).save(SNAPSHOT)).resolves.toStrictEqual({
        degraded: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        expect.stringContaining('save failed'),
      );
    });

    // exec resolves null on an aborted transaction rather than rejecting, so a
    // check that only looks at the entries calls a lost write a success.
    it('warns when the transaction was aborted', async () => {
      const aborted = {
        multi: () => {
          const chain = {
            set: () => chain,
            exec: () => Promise.resolve(null),
          };

          return chain;
        },
      } as unknown as Redis;

      await expect(build(aborted).save(SNAPSHOT)).resolves.toStrictEqual({
        degraded: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        expect.stringContaining('save failed'),
      );
    });
  });

  describe('reads', () => {
    it('returns the snapshot the fresh key holds', async () => {
      await repository.save(SNAPSHOT);

      await expect(repository.getFresh()).resolves.toStrictEqual({
        snapshot: SNAPSHOT,
        degraded: false,
      });
    });

    it('returns the snapshot the fallback key holds', async () => {
      await repository.save(SNAPSHOT);

      await expect(repository.getStale()).resolves.toStrictEqual({
        snapshot: SNAPSHOT,
        degraded: false,
      });
    });

    // A key that expired is a cache that answered. The caller pays an upstream
    // call for it and nobody needs to be told, which is what separates it from
    // the case below.
    it('is a miss, not a degradation, when the key has expired', async () => {
      await expect(repository.getFresh()).resolves.toStrictEqual({
        snapshot: null,
        degraded: false,
      });
      await expect(repository.getStale()).resolves.toStrictEqual({
        snapshot: null,
        degraded: false,
      });
    });

    it('treats a value that is not JSON as a miss and says so', async () => {
      client.seed(RATES_CACHE_KEYS.fresh, 'not json');

      await expect(repository.getFresh()).resolves.toStrictEqual({
        snapshot: null,
        degraded: false,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('corrupt'),
      );
    });

    it('treats a snapshot of the wrong shape as a miss', async () => {
      client.seed(
        RATES_CACHE_KEYS.fresh,
        JSON.stringify({ fetchedAt: 42, rates: 'none' }),
      );

      await expect(repository.getFresh()).resolves.toStrictEqual({
        snapshot: null,
        degraded: false,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('corrupt'),
      );
    });

    // The cache could not be reached, which is not the same answer as a key
    // that was not there: §3 reports this one to the client.
    it('degrades to a miss and says so when redis is unreachable', async () => {
      const offline = build(new FakeRedisClient().asRedis());

      await expect(offline.getFresh()).resolves.toStrictEqual({
        snapshot: null,
        degraded: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        expect.stringContaining(`read of ${RATES_CACHE_KEYS.fresh}`),
      );
    });

    // A connected client whose command never comes back is the case the socket
    // options cannot catch: only `commandTimeout` turns it into the rejection
    // the repository degrades on, and without it GET /rates waits forever.
    it('degrades to a miss when a command outlives its deadline', async () => {
      const stalled = new FakeRedisClient({ commandsTimeOut: true });
      await stalled.connect();

      await expect(build(stalled.asRedis()).getFresh()).resolves.toStrictEqual({
        snapshot: null,
        degraded: true,
      });

      // The message the deadline produced reaches the log as the error field's
      // own, which is where a stack survives.
      expect(logger.warn).toHaveBeenCalledWith(
        {
          err: expect.objectContaining({ message: COMMAND_TIMED_OUT }) as Error,
        },
        expect.stringContaining('read of'),
      );
    });
  });

  describe('clear', () => {
    it('removes both keys', async () => {
      await repository.save(SNAPSHOT);

      await repository.clear();

      expect(client.stored(RATES_CACHE_KEYS.fresh)).toBeUndefined();
      expect(client.stored(RATES_CACHE_KEYS.stale)).toBeUndefined();
    });

    // The one method that does not degrade: an invalidation is a state change
    // the caller commanded, and answering success for keys that are still
    // there tells an operator the cache is empty while the rates they were
    // clearing keep being served.
    it('refuses to report an invalidation redis never performed', async () => {
      const offline = build(new FakeRedisClient().asRedis());

      await expect(offline.clear()).rejects.toBeInstanceOf(
        CacheUnavailableError,
      );

      expect(logger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) as Error },
        expect.stringContaining('clear failed'),
      );
    });
  });
});
