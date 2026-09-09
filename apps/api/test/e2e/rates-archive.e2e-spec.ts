import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/errors/error-code.enum';
import { FakeRedisClient } from '../../src/infrastructure/redis/__tests__/fake-redis-client';
import { InMemoryRatesArchive } from '../../src/modules/rates/__tests__/in-memory-rates-archive.repository';
import { ArchivedSnapshot } from '../../src/modules/rates/domain/rate-history.types';
import { RATES_PROVIDER } from '../../src/modules/rates/domain/rates-provider.interface';
import { RATES_CACHE_KEYS } from '../../src/modules/rates/infrastructure/rates-cache-keys.constants';
import { createE2eApp } from './create-e2e-app';
import { RATES_SNAPSHOT } from './fixtures/rates-snapshot';
import { overrideRatesArchive } from './override-rates-archive';
import { overrideRedis } from './override-redis';

const RATES_PATH = '/api/v1/rates';
const HISTORY_PATH = '/api/v1/rates/history';
const CONVERT_PATH = '/api/v1/convert';

// What a mongoose failure carries: the host, and with a password in the url the
// credentials. None of it may reach the client.
const DRIVER_FAILURE = new Error(
  'failed to connect to server mongodb://admin:hunter2@10.0.0.4:27017',
);

// Dated against the clock rather than pinned: the window is "today and the days
// before it", so a fixed date would fall outside every window a later run asks
// for. Read once for the whole suite: a day seeded at 23:59:59.999 and asserted
// at 00:00:00.000 would otherwise be two different days.
const NOW = Date.now();

function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString().slice(0, 10);
}

const TODAY = daysAgo(0);

function archived(date: string, buy: number): ArchivedSnapshot {
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
      {
        base: 'EUR',
        quote: 'USD',
        cross: 1.16,
        date: `${date}T22:00:00.000Z`,
      },
    ],
  };
}

interface ProviderStub {
  fetchRates: jest.Mock;
}

interface Point {
  date: string;
  buy?: number;
  sell?: number;
  cross?: number;
}

// supertest types the body as any.
function pointsOf(response: request.Response): Point[] {
  return (response.body as { points: Point[] }).points;
}

describe('rates archive (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let redis: FakeRedisClient;
  let provider: ProviderStub;

  async function boot(archive: InMemoryRatesArchive): Promise<void> {
    app = await createE2eApp(
      { imports: [AppModule] },
      {
        customise: (builder) =>
          overrideRatesArchive(overrideRedis(builder, redis), archive)
            .overrideProvider(RATES_PROVIDER)
            .useValue(provider),
      },
    );

    // INestApplication.getHttpServer is typed as any.
    server = app.getHttpServer() as Server;
  }

  beforeEach(() => {
    redis = new FakeRedisClient();
    provider = { fetchRates: jest.fn().mockResolvedValue(RATES_SNAPSHOT) };
  });

  afterEach(async () => {
    await app.close();
  });

  // The fourth tier (§4). Every earlier one is gone: the upstream is refusing
  // connections and neither cache key survived, which is exactly the outage the
  // archive exists for.
  describe('as the last fallback', () => {
    beforeEach(() => {
      provider.fetchRates.mockRejectedValue(
        new Error('connect ECONNREFUSED api.monobank.ua:443'),
      );
    });

    it('serves the newest archived day and dates the answer from it', async () => {
      const day = archived(daysAgo(2), 44.1);
      await boot(
        new InMemoryRatesArchive({ seed: [archived(daysAgo(5), 43.4), day] }),
      );

      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toStrictEqual({
        source: 'archive',
        fetchedAt: day.fetchedAt,
        rates: day.rates,
      });
    });

    it('prices a conversion from the archived snapshot, saying so', async () => {
      await boot(
        new InMemoryRatesArchive({ seed: [archived(daysAgo(1), 44.0)] }),
      );

      const response = await request(server)
        .post(CONVERT_PATH)
        .send({ from: 'USD', to: 'UAH', amount: 100 })
        .expect(200);

      expect(response.body).toMatchObject({
        result: 4400,
        rate: 44,
        source: 'archive',
      });
    });

    // The retention is how far back /rates/history charts; it is not a
    // statement about what may price a conversion. Past
    // RATES_ARCHIVE_FALLBACK_MAX_AGE_DAYS the tier declines rather than
    // answering 200 from a rate no client would have taken.
    describe('with nothing archived inside the fallback age ceiling', () => {
      beforeEach(async () => {
        await boot(
          new InMemoryRatesArchive({ seed: [archived(daysAgo(8), 43.0)] }),
        );
      });

      it('answers 503 rather than pricing from the day it has', async () => {
        const response = await request(server).get(RATES_PATH).expect(503);

        expect(response.body).toMatchObject({
          statusCode: 503,
          code: ErrorCode.RATES_UNAVAILABLE,
          details: {
            reason: expect.stringContaining(
              'past the 7 day fallback ceiling',
            ) as string,
          },
        });
      });

      // The reviewer's case: a conversion is where an old rate does damage,
      // because a 200 there is a number the client uses.
      it('refuses the conversion on the same terms', async () => {
        const response = await request(server)
          .post(CONVERT_PATH)
          .send({ from: 'USD', to: 'UAH', amount: 100 })
          .expect(503);

        expect(response.body).toMatchObject({
          code: ErrorCode.RATES_UNAVAILABLE,
        });
      });
    });

    // A day inside the ceiling is served, which is what makes the refusal above
    // about the age rather than about the tier.
    it('still serves an archived day inside the ceiling', async () => {
      await boot(
        new InMemoryRatesArchive({ seed: [archived(daysAgo(6), 43.5)] }),
      );

      await request(server).get(RATES_PATH).expect(200);
    });

    it('answers 503 in the documented envelope with an empty archive', async () => {
      await boot(new InMemoryRatesArchive());

      const response = await request(server).get(RATES_PATH).expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        code: ErrorCode.RATES_UNAVAILABLE,
        path: RATES_PATH,
        details: { reason: 'upstream request failed' },
      });
    });

    // An archive that cannot be read is a fallback with nothing in it, not a
    // second failure to report: the client is already being told the rates are
    // unavailable and why.
    it('answers the same 503 when the archive itself cannot be read', async () => {
      await boot(new InMemoryRatesArchive({ failsWith: DRIVER_FAILURE }));

      const response = await request(server).get(RATES_PATH).expect(503);

      expect(response.body).toMatchObject({
        code: ErrorCode.RATES_UNAVAILABLE,
      });
      expect(JSON.stringify(response.body)).not.toContain('hunter2');
    });

    // The order §4 states: the fallback key is hours old and the archive is
    // days old, so the archive is only reached once the fallback has missed.
    it('is not reached while the fallback key still has a copy', async () => {
      const archive = new InMemoryRatesArchive({
        seed: [archived(daysAgo(1), 44.0)],
      });
      provider.fetchRates.mockResolvedValueOnce(RATES_SNAPSHOT);
      await boot(archive);

      await request(server).get(RATES_PATH).expect(200);
      await redis.del(RATES_CACHE_KEYS.fresh);

      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toMatchObject({
        source: 'stale-cache',
        fetchedAt: RATES_SNAPSHOT.fetchedAt,
      });
    });
  });

  describe('what a successful fetch leaves behind', () => {
    it('archives the day it fetched, so a later outage has an answer', async () => {
      const archive = new InMemoryRatesArchive();
      await boot(archive);

      await request(server).get(RATES_PATH).expect(200);

      await expect(archive.findLatest()).resolves.toMatchObject({
        fetchedAt: RATES_SNAPSHOT.fetchedAt,
      });
    });

    it('says nothing on the response when the day was archived', async () => {
      await boot(new InMemoryRatesArchive());

      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).not.toHaveProperty('warnings');
    });

    // The rates were fetched and served; what was lost is the day, which the
    // client would otherwise only discover as a gap in /rates/history.
    it('warns when the day could not be archived', async () => {
      await boot(new InMemoryRatesArchive({ failsWith: DRIVER_FAILURE }));

      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toMatchObject({
        source: 'provider',
        warnings: [
          {
            code: 'ARCHIVE_NOT_RECORDED',
            message: expect.stringContaining('/rates/history') as string,
          },
        ],
      });
    });

    it('carries the same warning on a conversion that fetched', async () => {
      await boot(new InMemoryRatesArchive({ failsWith: DRIVER_FAILURE }));

      const response = await request(server)
        .post(CONVERT_PATH)
        .send({ from: 'USD', to: 'UAH', amount: 100 })
        .expect(200);

      expect(
        (response.body as { warnings: { code: string }[] }).warnings.map(
          (warning) => warning.code,
        ),
      ).toContain('ARCHIVE_NOT_RECORDED');
    });

    // Nothing was fetched, so there was nothing to archive: a cache hit must
    // not warn about a write it never made.
    it('says nothing about the archive on a cache hit', async () => {
      await boot(new InMemoryRatesArchive({ failsWith: DRIVER_FAILURE }));

      await request(server).get(RATES_PATH).expect(200);
      const response = await request(server).get(RATES_PATH).expect(200);

      expect(response.body).toMatchObject({ source: 'cache' });
      expect(response.body).not.toHaveProperty('warnings');
    });
  });

  describe('GET /rates/history', () => {
    beforeEach(async () => {
      await boot(
        new InMemoryRatesArchive({
          seed: [
            archived(daysAgo(3), 43.9),
            archived(daysAgo(1), 44.2),
            archived(TODAY, 44.35),
          ],
        }),
      );
    });

    it('answers the pair, the window and the points oldest first', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=USD&quote=UAH&days=7`)
        .expect(200);

      expect(response.body).toStrictEqual({
        base: 'USD',
        quote: 'UAH',
        days: 7,
        points: [
          { date: daysAgo(3), buy: 43.9, sell: 44.4 },
          { date: daysAgo(1), buy: 44.2, sell: 44.7 },
          { date: TODAY, buy: 44.35, sell: 44.85 },
        ],
      });
    });

    it('upper-cases the codes and defaults the window to a week', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=usd&quote=uah`)
        .expect(200);

      expect(response.body).toMatchObject({
        base: 'USD',
        quote: 'UAH',
        days: 7,
      });
    });

    // A day outside the window is not a shorter answer, it is a different
    // question.
    it('trims the series to the window that was asked for', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=USD&quote=UAH&days=2`)
        .expect(200);

      expect(pointsOf(response).map((point) => point.date)).toStrictEqual([
        daysAgo(1),
        TODAY,
      ]);
    });

    // A pair with no spread publishes a mid rate and nothing else (§5).
    it('publishes a mid rate without the spread keys', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=EUR&quote=USD&days=7`)
        .expect(200);

      expect(pointsOf(response)[0]).toStrictEqual({
        date: daysAgo(3),
        cross: 1.16,
      });
    });

    it('rejects a code the archive never quoted', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=XYZ&quote=UAH&days=7`)
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        code: ErrorCode.UNSUPPORTED_CURRENCY,
        details: { currency: 'XYZ' },
      });
    });

    // Both codes are archived and there is still no series: the orientation is
    // the upstream's own, and this route reports what was published rather than
    // what could be derived from it.
    it('rejects the reversed orientation of a pair it can serve', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=UAH&quote=USD&days=7`)
        .expect(422);

      expect(response.body).toMatchObject({
        statusCode: 422,
        code: ErrorCode.RATE_NOT_AVAILABLE,
        details: { from: 'UAH', to: 'USD' },
      });
    });

    it.each([['0'], ['91'], ['abc'], ['1.5'], ['-1']])(
      'rejects ?days=%s, naming the field',
      async (days) => {
        const response = await request(server)
          .get(`${HISTORY_PATH}?base=USD&quote=UAH&days=${days}`)
          .expect(400);

        expect(response.body).toMatchObject({
          statusCode: 400,
          code: ErrorCode.VALIDATION_ERROR,
          details: {
            errors: [
              { field: 'days', messages: expect.any(Array) as string[] },
            ],
          },
        });
      },
    );

    it.each([['base'], ['quote']])(
      'rejects a request with no %s',
      async (field) => {
        const query = new URLSearchParams({ base: 'USD', quote: 'UAH' });
        query.delete(field);

        const response = await request(server)
          .get(`${HISTORY_PATH}?${query.toString()}`)
          .expect(400);

        expect(response.body).toMatchObject({
          code: ErrorCode.VALIDATION_ERROR,
          details: { errors: [{ field }] },
        });
      },
    );

    it('rejects a code that is not three letters', async () => {
      await request(server)
        .get(`${HISTORY_PATH}?base=US&quote=UAH`)
        .expect(400);
    });
  });

  describe('when the archive cannot be read', () => {
    beforeEach(async () => {
      await boot(new InMemoryRatesArchive({ failsWith: DRIVER_FAILURE }));
    });

    // An empty series would read as "this pair was never published", which is
    // a different answer from "the store is down".
    it('answers 503 with its own code rather than an empty series', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=USD&quote=UAH&days=7`)
        .expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        code: ErrorCode.ARCHIVE_UNAVAILABLE,
        path: `${HISTORY_PATH}?base=USD&quote=UAH&days=7`,
        details: { reason: 'read failed' },
      });
    });

    it('never names the database in the envelope it answers with', async () => {
      const response = await request(server)
        .get(`${HISTORY_PATH}?base=USD&quote=UAH`)
        .expect(503);

      expect(JSON.stringify(response.body)).not.toContain('hunter2');
      expect(JSON.stringify(response.body)).not.toContain('10.0.0.4');
    });

    // §2: the archive is a dependency of one route, not of the API.
    it('keeps answering conversions', async () => {
      const response = await request(server)
        .post(CONVERT_PATH)
        .send({ from: 'USD', to: 'UAH', amount: 100 })
        .expect(200);

      expect(response.body).toMatchObject({ result: 4435, rate: 44.35 });
    });
  });
});
