import type Redis from 'ioredis';
import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../../../config/__tests__/fake-config';
import {
  COMMAND_TIMED_OUT,
  FakeRedisClient,
} from '../../../../infrastructure/redis/__tests__/fake-redis-client';
import { RatesSnapshot } from '../../domain/rates-snapshot';
import { RATES_CACHE_KEYS } from '../rates-cache-keys';
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
      await repository.save(SNAPSHOT);

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

      await expect(offline.save(SNAPSHOT)).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
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

      await build(rejected).save(SNAPSHOT);

      expect(logger.warn).toHaveBeenCalledWith(
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

      await build(aborted).save(SNAPSHOT);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('save failed'),
      );
    });
  });

  describe('reads', () => {
    it('returns the snapshot the fresh key holds', async () => {
      await repository.save(SNAPSHOT);

      await expect(repository.getFresh()).resolves.toStrictEqual(SNAPSHOT);
    });

    it('returns the snapshot the fallback key holds', async () => {
      await repository.save(SNAPSHOT);

      await expect(repository.getStale()).resolves.toStrictEqual(SNAPSHOT);
    });

    it('is a miss when the key has expired', async () => {
      await expect(repository.getFresh()).resolves.toBeNull();
      await expect(repository.getStale()).resolves.toBeNull();
    });

    it('treats a value that is not JSON as a miss and says so', async () => {
      client.seed(RATES_CACHE_KEYS.fresh, 'not json');

      await expect(repository.getFresh()).resolves.toBeNull();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('corrupt'),
      );
    });

    it('treats a snapshot of the wrong shape as a miss', async () => {
      client.seed(
        RATES_CACHE_KEYS.fresh,
        JSON.stringify({ fetchedAt: 42, rates: 'none' }),
      );

      await expect(repository.getFresh()).resolves.toBeNull();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('corrupt'),
      );
    });

    it('degrades to a miss and warns when redis is unreachable', async () => {
      const offline = build(new FakeRedisClient().asRedis());

      await expect(offline.getFresh()).resolves.toBeNull();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`read of ${RATES_CACHE_KEYS.fresh}`),
      );
    });

    // A connected client whose command never comes back is the case the socket
    // options cannot catch: only `commandTimeout` turns it into the rejection
    // the repository degrades on, and without it GET /rates waits forever.
    it('degrades to a miss when a command outlives its deadline', async () => {
      const stalled = new FakeRedisClient({ commandsTimeOut: true });
      await stalled.connect();

      await expect(build(stalled.asRedis()).getFresh()).resolves.toBeNull();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(COMMAND_TIMED_OUT),
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

    it('degrades and warns when redis is unreachable', async () => {
      const offline = build(new FakeRedisClient().asRedis());

      await expect(offline.clear()).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('clear failed'),
      );
    });
  });
});
