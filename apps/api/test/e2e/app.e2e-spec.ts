import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/errors/error-code.enum';
import type { TypedConfigService } from '../../src/config/typed-config.service';
import { configureHttp } from '../../src/configure-http';

const REQUEST_ID_HEADER = 'x-request-id';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('API (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    configureHttp(app, app.get<TypedConfigService>(ConfigService));

    await app.init();

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
      expect(response.body).toMatchObject({ status: 'ok', details: {} });
    });

    it('is not exposed under the api/v1 prefix', async () => {
      await request(server).get('/api/v1/health').expect(404);
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

    it('generates a distinct id per request', async () => {
      const first = await request(server).get('/health');
      const second = await request(server).get('/health');

      expect(first.headers[REQUEST_ID_HEADER]).not.toBe(
        second.headers[REQUEST_ID_HEADER],
      );
    });
  });
});
