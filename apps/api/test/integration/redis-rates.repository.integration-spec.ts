import Redis from 'ioredis';
import { createFakePinoLogger } from '../../src/common/logging/__tests__/fake-pino-logger';
import { fakeConfig } from '../../src/config/__tests__/fake-config';
import { RatesSnapshot } from '../../src/modules/rates/domain/exchange-rate.types';
import { RATES_CACHE_KEYS } from '../../src/modules/rates/infrastructure/rates-cache-keys.constants';
import { RedisRatesRepository } from '../../src/modules/rates/infrastructure/redis-rates.repository';
import { describeAgainst } from './gate';

const FRESH_TTL_SECONDS = 300;
const STALE_TTL_SECONDS = 86_400;

// The suite writes the application's own key names, and `INTEGRATION_REDIS_URL`
// may well be a stack someone is using, where `rates:latest` is the cache it is
// serving from. Redis numbers sixteen databases and the app only ever uses the
// default one, so the last is free to be emptied between cases.
const TEST_DB = 15;

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

describeAgainst(
  'RedisRatesRepository against a real Redis',
  'INTEGRATION_REDIS_URL',
  (url) => {
    let client: Redis;
    let repository: RedisRatesRepository;

    beforeAll(async () => {
      client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        db: TEST_DB,
      });
      await client.connect();
      // Selected as well as configured: ioredis lets a database in the URL's
      // path win over the option, and FLUSHDB must not land on whatever that
      // would be. The option is what a reconnect re-selects, so both are here.
      await client.select(TEST_DB);
      // FLUSHDB, not FLUSHALL: it is scoped to the selected database, and what
      // it clears here is whatever an interrupted run left behind.
      await client.flushdb();
    });

    afterAll(async () => {
      await client.flushdb();
      await client.quit();
    });

    beforeEach(async () => {
      await client.flushdb();
      repository = new RedisRatesRepository(
        client,
        fakeConfig({
          RATES_CACHE_TTL_SECONDS: FRESH_TTL_SECONDS,
          RATES_STALE_TTL_SECONDS: STALE_TTL_SECONDS,
        }),
        createFakePinoLogger().asPinoLogger(),
      );
    });

    // The unit spec asserts the expiries against a fake that records what it was
    // asked to do; this asks Redis what it actually holds.
    it('writes both keys with their TTLs', async () => {
      await expect(repository.save(SNAPSHOT)).resolves.toStrictEqual({
        degraded: false,
      });

      await expect(client.get(RATES_CACHE_KEYS.fresh)).resolves.toBe(
        JSON.stringify(SNAPSHOT),
      );
      await expect(client.get(RATES_CACHE_KEYS.stale)).resolves.toBe(
        JSON.stringify(SNAPSHOT),
      );

      // TTL rather than PTTL: the second the command spends in flight must not
      // make the assertion flaky, and the fallback outliving the fresh key by a
      // day is the property that matters.
      expect(await client.ttl(RATES_CACHE_KEYS.fresh)).toBeLessThanOrEqual(
        FRESH_TTL_SECONDS,
      );
      expect(await client.ttl(RATES_CACHE_KEYS.fresh)).toBeGreaterThan(
        FRESH_TTL_SECONDS - 10,
      );
      expect(await client.ttl(RATES_CACHE_KEYS.stale)).toBeLessThanOrEqual(
        STALE_TTL_SECONDS,
      );
      expect(await client.ttl(RATES_CACHE_KEYS.stale)).toBeGreaterThan(
        STALE_TTL_SECONDS - 10,
      );
    });

    it('reads back what it wrote, from either key', async () => {
      await repository.save(SNAPSHOT);

      await expect(repository.getFresh()).resolves.toStrictEqual({
        snapshot: SNAPSHOT,
        degraded: false,
      });
      await expect(repository.getStale()).resolves.toStrictEqual({
        snapshot: SNAPSHOT,
        degraded: false,
      });
    });

    it('reports a miss, not an outage, when nothing is cached', async () => {
      await expect(repository.getFresh()).resolves.toStrictEqual({
        snapshot: null,
        degraded: false,
      });
    });

    it('removes both keys on clear, and is content with keys already gone', async () => {
      await repository.save(SNAPSHOT);

      await expect(repository.clear()).resolves.toBeUndefined();
      await expect(
        client.exists(RATES_CACHE_KEYS.fresh, RATES_CACHE_KEYS.stale),
      ).resolves.toBe(0);
      await expect(repository.clear()).resolves.toBeUndefined();
    });

    // The key outlives a deploy and is shared by every instance, so a value an
    // older shape wrote has to be discarded rather than served.
    it.each([
      ['not json at all', 'not json at all'],
      ['json of the wrong shape', JSON.stringify({ fetchedAt: 12 })],
    ])('treats a cached value that is %s as a miss', async (_case, value) => {
      await client.set(RATES_CACHE_KEYS.fresh, value);

      await expect(repository.getFresh()).resolves.toStrictEqual({
        snapshot: null,
        degraded: false,
      });
    });
  },
);
