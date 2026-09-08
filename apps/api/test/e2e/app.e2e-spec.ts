import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/errors/error-code.enum';
import { FakeMongoConnection } from '../../src/infrastructure/mongo/__tests__/fake-mongo-connection';
import { FakeRedisClient } from '../../src/infrastructure/redis/__tests__/fake-redis-client';
import { createE2eApp } from './create-e2e-app';
import { overrideMongo } from './override-mongo';
import { overrideRedis } from './override-redis';

const REQUEST_ID_HEADER = 'x-request-id';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('API (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    app = await createE2eApp({ imports: [AppModule] });

    // INestApplication.getHttpServer is typed as any.
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('reports ok outside the versioned prefix', async () => {
      const response = await request(server).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        details: {
          redis: { status: 'up' },
          mongodb: { status: 'up' },
          monobank: { status: 'up' },
        },
      });
    });

    it('is not exposed under the api/v1 prefix', async () => {
      await request(server).get('/api/v1/health').expect(404);
    });
  });

  // The split §3 records: /health is the dependency report and answers 503 when
  // one is down, /health/live is what a deploy gate and a container health
  // check probe. A store only /history needs must not fail the rollout of a
  // process that is up and still converting, so these two have to disagree.
  describe('GET /health/live', () => {
    let degraded: INestApplication;
    let degradedServer: Server;

    beforeAll(async () => {
      degraded = await createE2eApp(
        { imports: [AppModule] },
        {
          customise: (builder) =>
            overrideMongo(
              overrideRedis(
                builder,
                new FakeRedisClient({ unreachable: true }),
              ),
              // Never settled: the connection mongoose is still opening while
              // the server it is opening to is not there.
              new FakeMongoConnection({ unreachable: true }),
            ),
        },
      );

      degradedServer = degraded.getHttpServer() as Server;
    });

    afterAll(async () => {
      await degraded.close();
    });

    it('answers 200 while the dependencies report down', async () => {
      const response = await request(degradedServer)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({ status: 'ok', details: {} });
    });

    it('is the only one of the two that says so', async () => {
      const response = await request(degradedServer).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'error',
        error: {
          redis: { status: 'down' },
          mongodb: { status: 'down' },
        },
      });
    });

    it('is not exposed under the api/v1 prefix', async () => {
      await request(degradedServer).get('/api/v1/health/live').expect(404);
    });
  });

  describe('unknown routes', () => {
    it('answers with the documented error envelope', async () => {
      const response = await request(server).get('/api/v1/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        code: ErrorCode.NOT_FOUND,
        path: '/api/v1/does-not-exist',
      });

      const body = response.body as Record<string, unknown>;
      expect(typeof body.message).toBe('string');
      expect(typeof body.timestamp).toBe('string');
      expect(typeof body.requestId).toBe('string');
    });

    it('reports the same request id in the envelope and the header', async () => {
      const response = await request(server)
        .get('/api/v1/does-not-exist')
        .set(REQUEST_ID_HEADER, 'trace-from-the-gateway');

      expect(response.headers[REQUEST_ID_HEADER]).toBe(
        'trace-from-the-gateway',
      );
      expect(response.body).toMatchObject({
        requestId: 'trace-from-the-gateway',
      });
    });
  });

  describe('request id', () => {
    it('echoes an inbound x-request-id', async () => {
      const response = await request(server)
        .get('/health')
        .set(REQUEST_ID_HEADER, 'trace-from-the-gateway');

      expect(response.headers[REQUEST_ID_HEADER]).toBe(
        'trace-from-the-gateway',
      );
    });

    it('generates one when the caller sends none', async () => {
      const response = await request(server).get('/health');

      expect(response.headers[REQUEST_ID_HEADER]).toMatch(UUID_PATTERN);
    });

    it('replaces an inbound id too long to be a trace id', async () => {
      const response = await request(server)
        .get('/health')
        .set(REQUEST_ID_HEADER, 'a'.repeat(129));

      expect(response.headers[REQUEST_ID_HEADER]).toMatch(UUID_PATTERN);
    });

    it('replaces an inbound id carrying characters a log line cannot hold', async () => {
      const response = await request(server)
        .get('/health')
        .set(REQUEST_ID_HEADER, 'trace injected');

      expect(response.headers[REQUEST_ID_HEADER]).toMatch(UUID_PATTERN);
    });

    it('generates a distinct id per request', async () => {
      const first = await request(server).get('/health');
      const second = await request(server).get('/health');

      expect(first.headers[REQUEST_ID_HEADER]).not.toBe(
        second.headers[REQUEST_ID_HEADER],
      );
    });
  });

  // Nest installs its body parser after everything configureHttp registers and
  // before any module middleware, so a body that dies in the parser never
  // reaches pino: the id has to come from the middleware registered first.
  describe('a body the parser cannot read', () => {
    function postMalformedJson(inboundRequestId?: string): request.Test {
      const pending = request(server)
        .post('/api/v1/does-not-exist')
        .set('Content-Type', 'application/json');

      if (inboundRequestId !== undefined) {
        pending.set(REQUEST_ID_HEADER, inboundRequestId);
      }

      return pending.send('{bad');
    }

    it('answers with the error envelope', async () => {
      const response = await postMalformedJson();

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        path: '/api/v1/does-not-exist',
      });
    });

    it('still reports a request id in the envelope and the header', async () => {
      const response = await postMalformedJson();
      const requestId = response.headers[REQUEST_ID_HEADER];

      expect(requestId).toMatch(UUID_PATTERN);
      expect(response.body).toMatchObject({ requestId });
    });

    it('keeps the trace id the caller sent', async () => {
      const response = await postMalformedJson('trace-from-the-gateway');

      expect(response.headers[REQUEST_ID_HEADER]).toBe(
        'trace-from-the-gateway',
      );
      expect(response.body).toMatchObject({
        requestId: 'trace-from-the-gateway',
      });
    });
  });
});
