// Must stay the first import: it sets the admin key this suite runs under, and
// app.module.ts reads it while being imported.
import { ADMIN_API_KEY } from './env/admin-key';
import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/errors/error-code.enum';
import { API_KEY_HEADER } from '../../src/common/guards/api-key.guard';
import { FakeRedisClient } from '../../src/infrastructure/redis/__tests__/fake-redis-client';
import { RATES_PROVIDER } from '../../src/modules/rates/domain/ports';
import { RATES_CACHE_KEYS } from '../../src/modules/rates/infrastructure/rates-cache-keys';
import { createE2eApp } from './create-e2e-app';
import { overrideRedis } from './override-redis';
import { RATES_SNAPSHOT, SNAPSHOT_CURRENCIES } from './fixtures/rates-snapshot';

const RATES_PATH = '/api/v1/rates';
const CACHE_PATH = '/api/v1/rates/cache';
const CURRENCIES_PATH = '/api/v1/currencies';

interface ProviderStub {
  fetchRates: jest.Mock;
}

describe('rates (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let redis: FakeRedisClient;
  let provider: ProviderStub;

  async function boot(): Promise<void> {
    app = await createE2eApp(
      { imports: [AppModule] },
      {
        customise: (builder) =>
          overrideRedis(builder, redis)
            .overrideProvider(RATES_PROVIDER)
            .useValue(provider),
      },
    );

    // INestApplication.getHttpServer is typed as any.
    server = app.getHttpServer() as Server;
  }

  // A fresh app per test: the cache and the upstream stub are both state that
  // outlives a request, and every case here is about what the second one does.
  beforeEach(async () => {
    redis = new FakeRedisClient();
    provider = { fetchRates: jest.fn().mockResolvedValue(RATES_SNAPSHOT) };

    await boot();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /rates', () => {
    it('answers the first call from the upstream and says so', async () => {
      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toStrictEqual({
        source: 'provider',
        fetchedAt: RATES_SNAPSHOT.fetchedAt,
        rates: RATES_SNAPSHOT.rates,
      });
    });

    it('answers the second call from the cache without calling out again', async () => {
      await request(server).get(RATES_PATH).expect(200);
      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toMatchObject({ source: 'cache' });
      expect(provider.fetchRates).toHaveBeenCalledTimes(1);
    });

    it('caches both the fresh key and the fallback it will need later', async () => {
      await request(server).get(RATES_PATH).expect(200);

      expect(redis.stored(RATES_CACHE_KEYS.fresh)).toBeDefined();
      expect(redis.stored(RATES_CACHE_KEYS.stale)).toBeDefined();
    });
  });

  describe('DELETE /rates/cache', () => {
    it('empties the cache so the next read reaches the upstream again', async () => {
      await request(server).get(RATES_PATH).expect(200);

      await request(server)
        .delete(CACHE_PATH)
        .set(API_KEY_HEADER, ADMIN_API_KEY)
        .expect(204);

      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toMatchObject({ source: 'provider' });
      expect(provider.fetchRates).toHaveBeenCalledTimes(2);
    });

    it('answers 204 with no body', async () => {
      const response = await request(server)
        .delete(CACHE_PATH)
        .set(API_KEY_HEADER, ADMIN_API_KEY)
        .expect(204);

      expect(response.body).toStrictEqual({});
    });

    it('refuses a request that carries no key', async () => {
      const response = await request(server).delete(CACHE_PATH).expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        code: ErrorCode.UNAUTHORIZED,
        path: CACHE_PATH,
      });
    });

    it('refuses a request that carries the wrong key', async () => {
      await request(server)
        .delete(CACHE_PATH)
        .set(API_KEY_HEADER, 'not-the-admin-key')
        .expect(401);
    });

    it('leaves the cache alone when the key is wrong', async () => {
      await request(server).get(RATES_PATH).expect(200);

      await request(server)
        .delete(CACHE_PATH)
        .set(API_KEY_HEADER, 'not-the-admin-key')
        .expect(401);

      await request(server)
        .get(RATES_PATH)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ source: 'cache' });
        });
    });
  });

  describe('GET /currencies', () => {
    it('lists every currency of the snapshot, sorted and named', async () => {
      const response = await request(server).get(CURRENCIES_PATH).expect(200);

      expect(response.body).toStrictEqual({
        currencies: SNAPSHOT_CURRENCIES,
      });
    });

    it('reads the same snapshot the rates endpoint serves', async () => {
      await request(server).get(RATES_PATH).expect(200);
      await request(server).get(CURRENCIES_PATH).expect(200);

      expect(provider.fetchRates).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the upstream is failing', () => {
    it('answers 503 in the documented envelope with nothing cached', async () => {
      provider.fetchRates.mockRejectedValue(
        new Error('connect ECONNREFUSED api.monobank.ua:443'),
      );

      const response = await request(server).get(RATES_PATH).expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        code: ErrorCode.RATES_UNAVAILABLE,
        path: RATES_PATH,
        details: { reason: 'upstream request failed' },
      });
    });

    it('never names the upstream in the envelope it answers with', async () => {
      provider.fetchRates.mockRejectedValue(
        new Error('connect ECONNREFUSED api.monobank.ua:443'),
      );

      const response = await request(server).get(RATES_PATH).expect(503);

      expect(JSON.stringify(response.body)).not.toContain('monobank');
    });

    // The fallback key outlives the fresh one by a day, which is the whole
    // reason it is written: an outage that starts after the TTL expired still
    // has an answer, and the client can see that it is an old one.
    it('falls back to the stale copy once the fresh key has expired', async () => {
      await request(server).get(RATES_PATH).expect(200);
      await redis.del(RATES_CACHE_KEYS.fresh);
      provider.fetchRates.mockRejectedValue(new Error('upstream down'));

      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toMatchObject({
        source: 'stale-cache',
        fetchedAt: RATES_SNAPSHOT.fetchedAt,
      });
    });

    it('still lists the currencies of the stale snapshot', async () => {
      await request(server).get(RATES_PATH).expect(200);
      await redis.del(RATES_CACHE_KEYS.fresh);
      provider.fetchRates.mockRejectedValue(new Error('upstream down'));

      const response = await request(server).get(CURRENCIES_PATH).expect(200);

      expect(response.body).toStrictEqual({ currencies: SNAPSHOT_CURRENCIES });
    });
  });

  // Redis down is a degradation, not a failure: the rates are fetched from the
  // upstream and served, and the client is told what that cost.
  describe('when the cache cannot be reached', () => {
    beforeEach(async () => {
      await app.close();
      redis = new FakeRedisClient({ unreachable: true });

      await boot();
    });

    it('answers the snapshot from the upstream and warns', async () => {
      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toMatchObject({
        source: 'provider',
        fetchedAt: RATES_SNAPSHOT.fetchedAt,
        warnings: [
          {
            code: 'CACHE_UNAVAILABLE',
            message: expect.any(String) as string,
          },
        ],
      });
    });

    // A 204 here would tell the operator the keys are gone while the stale
    // rates they were clearing keep being served.
    it('refuses to report an invalidation it could not perform', async () => {
      const response = await request(server)
        .delete(CACHE_PATH)
        .set(API_KEY_HEADER, ADMIN_API_KEY)
        .expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        code: ErrorCode.CACHE_UNAVAILABLE,
        path: CACHE_PATH,
      });
    });

    // The currencies list is a projection of the same snapshot, read the same
    // way, so it degrades the same way and says so on the same terms.
    it('lists the currencies and warns on the same terms', async () => {
      const response = await request(server).get(CURRENCIES_PATH).expect(200);

      expect(response.body).toStrictEqual({
        currencies: SNAPSHOT_CURRENCIES,
        warnings: [
          {
            code: 'CACHE_UNAVAILABLE',
            message: expect.any(String) as string,
          },
        ],
      });
    });

    // Every request pays the upstream, because nothing could be written for the
    // next one — which is the degradation the warning is about.
    it('fetches again on the next request, having cached nothing', async () => {
      await request(server).get(RATES_PATH).expect(200);
      await request(server).get(RATES_PATH).expect(200);

      expect(provider.fetchRates).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /health', () => {
    it('reports the cache and the upstream breaker', async () => {
      const response = await request(server).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        details: {
          redis: { status: 'up' },
          monobank: { status: 'up' },
        },
      });
    });
  });
});
