import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/errors/error-code.enum';
import { FakeRedisClient } from '../../src/infrastructure/redis/__tests__/fake-redis-client';
import { RATES_PROVIDER } from '../../src/modules/rates/domain/rates-provider.token';
import { RATES_CACHE_KEYS } from '../../src/modules/rates/infrastructure/rates-cache-keys';
import { createE2eApp } from './create-e2e-app';
import {
  DETACHED_RATES_SNAPSHOT,
  RATES_SNAPSHOT,
} from './fixtures/rates-snapshot';
import { overrideRedis } from './override-redis';

const CONVERT_PATH = '/api/v1/convert';

interface ProviderStub {
  fetchRates: jest.Mock;
}

interface ConvertBody {
  from?: unknown;
  to?: unknown;
  amount?: unknown;
}

describe('conversion (e2e)', () => {
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
  // outlives a request, and the degraded cases are about what the second one
  // does.
  beforeEach(async () => {
    redis = new FakeRedisClient();
    provider = { fetchRates: jest.fn().mockResolvedValue(RATES_SNAPSHOT) };

    await boot();
  });

  afterEach(async () => {
    await app.close();
  });

  function convert(body: ConvertBody): request.Test {
    return request(server).post(CONVERT_PATH).send(body);
  }

  describe('the documented response', () => {
    // §3's own example, priced from the fixture: EUR and GBP are both quoted
    // against the hryvnia and not against each other. The status is part of
    // the assertion — a conversion creates nothing and leaves nothing behind
    // to fetch, so the POST is not Nest's default 201 for one.
    it('answers 200, not 201, with exactly the fields §3 lists', async () => {
      const response = await convert({
        from: 'EUR',
        to: 'GBP',
        amount: 100,
      }).expect(200);

      expect(response.body).toStrictEqual({
        from: 'EUR',
        to: 'GBP',
        amount: 100,
        result: 85.09,
        rate: 0.850942,
        strategy: 'cross',
        source: 'provider',
        ratesTimestamp: RATES_SNAPSHOT.fetchedAt,
      });
    });
  });

  describe('pricing', () => {
    it('pays the buy rate converting the base of a pair into its quote', async () => {
      const response = await convert({
        from: 'USD',
        to: 'UAH',
        amount: 100,
      }).expect(200);

      expect(response.body).toMatchObject({
        rate: 44.35,
        result: 4435,
        strategy: 'direct',
      });
    });

    it('pays the sell rate converting the quote of a pair back into its base', async () => {
      const response = await convert({
        from: 'UAH',
        to: 'USD',
        amount: 1000,
      }).expect(200);

      expect(response.body).toMatchObject({
        rate: 0.022306,
        result: 22.31,
        strategy: 'direct',
      });
    });

    // Crossing EUR through the hryvnia would answer 1.15322 and lose a second
    // spread; the published pair is the better price and the one it takes.
    it('takes the published pair over the path through the hryvnia', async () => {
      const response = await convert({
        from: 'EUR',
        to: 'USD',
        amount: 100,
      }).expect(200);

      expect(response.body).toMatchObject({
        rate: 1.1655,
        result: 116.55,
        strategy: 'direct',
      });
    });

    // Both legs of the §5 table on mid rates: 60.7562 hryvnia to the pound out,
    // 1 / 12.1834 zloty to the hryvnia back. The rate is 4.98680171380731…,
    // published as 4.986802, and 250 of them is 1246.70042…, so the cent is
    // 1246.70. Rounding the rate first would agree here; the million-pound
    // case in the service spec is where the two answers part.
    it('crosses two currencies that only share the hryvnia', async () => {
      const response = await convert({
        from: 'GBP',
        to: 'PLN',
        amount: 250,
      }).expect(200);

      expect(response.body).toMatchObject({
        rate: 4.986802,
        result: 1246.7,
        strategy: 'cross',
      });
    });

    // The other end of the scale: 0.01 hryvnia is 0.000223 dollars, less than
    // half a cent, so the money rounds to nothing. It is a 200 rather than an
    // error — the conversion succeeded and that is what it is worth — and
    // `rate` is what makes the zero readable. §5 records the choice.
    it('answers zero for an amount worth less than half a cent', async () => {
      const response = await convert({
        from: 'UAH',
        to: 'USD',
        amount: 0.01,
      }).expect(200);

      expect(response.body).toMatchObject({
        amount: 0.01,
        result: 0,
        rate: 0.022306,
        strategy: 'direct',
      });
    });

    it('converts a currency to itself at one', async () => {
      const response = await convert({
        from: 'USD',
        to: 'USD',
        amount: 33.33,
      }).expect(200);

      expect(response.body).toMatchObject({
        rate: 1,
        result: 33.33,
        strategy: 'identity',
      });
    });

    it('normalises lower-case codes and echoes them upper-cased', async () => {
      const response = await convert({
        from: 'usd',
        to: 'uah',
        amount: 100,
      }).expect(200);

      expect(response.body).toMatchObject({
        from: 'USD',
        to: 'UAH',
        rate: 44.35,
      });
    });

    it('prices the second conversion from the cache without calling out again', async () => {
      await convert({ from: 'USD', to: 'UAH', amount: 1 }).expect(200);

      const response = await convert({
        from: 'GBP',
        to: 'PLN',
        amount: 1,
      }).expect(200);

      expect(response.body).toMatchObject({ source: 'cache' });
      expect(provider.fetchRates).toHaveBeenCalledTimes(1);
    });
  });

  describe('a request the API will not take', () => {
    it('rejects an amount sent as a string, naming the field', async () => {
      const response = await convert({
        from: 'USD',
        to: 'UAH',
        amount: '100',
      }).expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        path: CONVERT_PATH,
        details: {
          errors: [
            { field: 'amount', messages: expect.any(Array) as string[] },
          ],
        },
      });
    });

    it('rejects a body with a field missing', async () => {
      const response = await convert({ from: 'USD', amount: 100 }).expect(400);

      expect(response.body).toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        details: {
          errors: [expect.objectContaining({ field: 'to' }) as object],
        },
      });
    });

    it.each([[0], [-5], [1_000_000_000_001]])(
      'rejects %p as an amount',
      async (amount) => {
        await convert({ from: 'USD', to: 'UAH', amount }).expect(400);
      },
    );

    it('rejects a code that is not three letters', async () => {
      await convert({ from: 'US', to: 'UAH', amount: 100 }).expect(400);
    });
  });

  describe('a request the rates cannot answer', () => {
    it('reports a code the snapshot does not quote as unsupported', async () => {
      const response = await convert({
        from: 'XYZ',
        to: 'UAH',
        amount: 100,
      }).expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        code: ErrorCode.UNSUPPORTED_CURRENCY,
        path: CONVERT_PATH,
        details: { currency: 'XYZ' },
      });
    });

    // Identity prices any code against itself, so this pair is the one place a
    // code the snapshot never quotes could have answered 200 with rate 1. The
    // membership check runs before the strategy chain, so it does not.
    it('reports a code it never quotes converted to itself as unsupported', async () => {
      const response = await convert({
        from: 'XYZ',
        to: 'XYZ',
        amount: 100,
      }).expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        code: ErrorCode.UNSUPPORTED_CURRENCY,
        path: CONVERT_PATH,
        details: { currency: 'XYZ' },
      });
    });

    // Both codes are quoted and there is still no path between them: CHF is
    // priced only in dollars, so it has no leg to the hryvnia to cross through.
    it('reports two quoted currencies with no path between them', async () => {
      provider.fetchRates.mockResolvedValue(DETACHED_RATES_SNAPSHOT);

      const response = await convert({
        from: 'CHF',
        to: 'PLN',
        amount: 100,
      }).expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        code: ErrorCode.RATE_NOT_AVAILABLE,
        details: { from: 'CHF', to: 'PLN' },
      });
    });
  });

  // The cache being down slows a conversion, it does not fail one — and until
  // now the only place that was said was the log.
  describe('when the cache cannot be reached', () => {
    beforeEach(async () => {
      await app.close();
      redis = new FakeRedisClient({ unreachable: true });

      await boot();
    });

    it('prices the conversion from the upstream and warns', async () => {
      const response = await convert({
        from: 'USD',
        to: 'UAH',
        amount: 100,
      }).expect(200);

      expect(response.body).toMatchObject({
        result: 4435,
        rate: 44.35,
        source: 'provider',
        warnings: [
          {
            code: 'CACHE_UNAVAILABLE',
            message: expect.any(String) as string,
          },
        ],
      });
    });
  });

  describe('when the upstream is failing', () => {
    it('answers 503 with nothing cached to fall back to', async () => {
      provider.fetchRates.mockRejectedValue(
        new Error('connect ECONNREFUSED api.monobank.ua:443'),
      );

      const response = await convert({
        from: 'USD',
        to: 'UAH',
        amount: 100,
      }).expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        code: ErrorCode.RATES_UNAVAILABLE,
        path: CONVERT_PATH,
        details: { reason: 'upstream request failed' },
      });
    });

    it('never names the upstream in the envelope it answers with', async () => {
      provider.fetchRates.mockRejectedValue(
        new Error('connect ECONNREFUSED api.monobank.ua:443'),
      );

      const response = await convert({
        from: 'USD',
        to: 'UAH',
        amount: 100,
      }).expect(503);

      expect(JSON.stringify(response.body)).not.toContain('monobank');
    });

    // The conversion still happens, and `source` is how the client can tell it
    // was priced from rates older than the cache TTL.
    it('prices from the stale copy once the fresh key has expired', async () => {
      await convert({ from: 'USD', to: 'UAH', amount: 1 }).expect(200);
      await redis.del(RATES_CACHE_KEYS.fresh);
      provider.fetchRates.mockRejectedValue(new Error('upstream down'));

      const response = await convert({
        from: 'USD',
        to: 'UAH',
        amount: 100,
      }).expect(200);

      expect(response.body).toMatchObject({
        source: 'stale-cache',
        rate: 44.35,
        result: 4435,
        ratesTimestamp: RATES_SNAPSHOT.fetchedAt,
      });
    });
  });
});
