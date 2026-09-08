import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/errors/error-code.enum';
import { FakeRedisClient } from '../../src/infrastructure/redis/__tests__/fake-redis-client';
import { InMemoryHistoryRepository } from '../../src/modules/history/__tests__/in-memory-history.repository';
import { RATES_PROVIDER } from '../../src/modules/rates/domain/ports';
import { createE2eApp } from './create-e2e-app';
import { RATES_SNAPSHOT } from './fixtures/rates-snapshot';
import { overrideHistory } from './override-history';
import { overrideRedis } from './override-redis';

const HISTORY_PATH = '/api/v1/history';
const CONVERT_PATH = '/api/v1/convert';

// What a mongoose failure carries: the host, and with a password in the url the
// credentials. None of it may reach the client.
const DRIVER_FAILURE = new Error(
  'failed to connect to server mongodb://admin:hunter2@10.0.0.4:27017',
);

interface HistoryItem {
  from: string;
  to: string;
}

// supertest types the body as any.
function itemsOf(response: request.Response): HistoryItem[] {
  return (response.body as { items: HistoryItem[] }).items;
}

describe('history (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  async function boot(repository?: InMemoryHistoryRepository): Promise<void> {
    app = await createE2eApp(
      { imports: [AppModule] },
      {
        customise: (builder) => {
          const withStubs = overrideRedis(builder, new FakeRedisClient())
            .overrideProvider(RATES_PROVIDER)
            .useValue({ fetchRates: () => Promise.resolve(RATES_SNAPSHOT) });

          return repository === undefined
            ? withStubs
            : overrideHistory(withStubs, repository);
        },
      },
    );

    // INestApplication.getHttpServer is typed as any.
    server = app.getHttpServer() as Server;
  }

  function convert(from: string, to: string, amount: number): request.Test {
    return request(server).post(CONVERT_PATH).send({ from, to, amount });
  }

  afterEach(async () => {
    await app.close();
  });

  describe('what a conversion leaves behind', () => {
    beforeEach(async () => {
      await boot();
    });

    it('answers an empty page before anything has been converted', async () => {
      const response = await request(server).get(HISTORY_PATH).expect(200);

      expect(response.body).toStrictEqual({ items: [] });
    });

    it('records a conversion with exactly the fields §3 lists', async () => {
      await convert('EUR', 'GBP', 100).expect(200);

      const response = await request(server).get(HISTORY_PATH).expect(200);
      const [item] = itemsOf(response);

      expect(item).toStrictEqual({
        id: expect.any(String) as string,
        from: 'EUR',
        to: 'GBP',
        amount: 100,
        result: 85.09,
        rate: 0.850942,
        strategy: 'cross',
        source: 'provider',
        ratesTimestamp: RATES_SNAPSHOT.fetchedAt,
        createdAt: expect.any(String) as string,
      });
    });

    it('answers with the newest conversion first', async () => {
      await convert('USD', 'UAH', 100).expect(200);
      await convert('GBP', 'PLN', 250).expect(200);

      const response = await request(server).get(HISTORY_PATH).expect(200);
      const items = itemsOf(response);

      expect(items.map((item) => `${item.from}/${item.to}`)).toStrictEqual([
        'GBP/PLN',
        'USD/UAH',
      ]);
    });

    it('returns no more than the requested page', async () => {
      await convert('USD', 'UAH', 100).expect(200);
      await convert('GBP', 'PLN', 250).expect(200);

      const response = await request(server)
        .get(`${HISTORY_PATH}?limit=1`)
        .expect(200);
      const items = itemsOf(response);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ from: 'GBP', to: 'PLN' });
    });

    it.each([['0'], ['51'], ['abc'], ['1.5'], ['-1']])(
      'rejects ?limit=%s, naming the field',
      async (limit) => {
        const response = await request(server)
          .get(`${HISTORY_PATH}?limit=${limit}`)
          .expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          code: ErrorCode.VALIDATION_ERROR,
          // The envelope reports the url that was asked for, query included.
          path: `${HISTORY_PATH}?limit=${limit}`,
          details: {
            errors: [
              { field: 'limit', messages: expect.any(Array) as string[] },
            ],
          },
        });
      },
    );
  });

  describe('when the store is unreachable', () => {
    beforeEach(async () => {
      await boot(new InMemoryHistoryRepository({ failsWith: DRIVER_FAILURE }));
    });

    it('answers 503 with its own code rather than a 500', async () => {
      const response = await request(server).get(HISTORY_PATH).expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        code: ErrorCode.HISTORY_UNAVAILABLE,
        path: HISTORY_PATH,
        details: { reason: 'read failed' },
      });
    });

    it('never names the database in the envelope it answers with', async () => {
      const response = await request(server).get(HISTORY_PATH).expect(503);

      expect(JSON.stringify(response.body)).not.toContain('hunter2');
      expect(JSON.stringify(response.body)).not.toContain('10.0.0.4');
    });

    // §2: the history is a dependency of one route, not of the API.
    it('keeps answering conversions', async () => {
      const response = await convert('USD', 'UAH', 100).expect(200);

      expect(response.body).toMatchObject({ result: 4435, rate: 44.35 });
    });

    // The conversion is the answer and the record is a side effect of it, but a
    // client that reads /history back has to know this one will not be there.
    it('says on the conversion that it was not recorded', async () => {
      const response = await convert('USD', 'UAH', 100).expect(200);

      expect(response.body).toMatchObject({
        warnings: [
          {
            code: 'HISTORY_NOT_RECORDED',
            message: expect.stringContaining('/history') as string,
          },
        ],
      });
    });
  });

  describe('/health', () => {
    it('reports the database beside the cache and the upstream', async () => {
      await boot();

      const response = await request(server).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        details: { mongodb: { status: 'up' } },
      });
    });
  });
});
