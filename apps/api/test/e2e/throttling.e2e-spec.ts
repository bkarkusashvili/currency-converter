// Must stay the first import: it sets the throttle limit and the proxy depth
// this suite runs under, and app.module.ts reads both while being imported.
import './env/throttled';
import { Server } from 'node:http';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/errors/error-code.enum';
import { createE2eApp } from './create-e2e-app';

const THROTTLE_LIMIT = 2;
const REQUEST_ID_HEADER = 'x-request-id';

// /health is the only route the app serves and it is deliberately exempt from
// throttling, so the buckets need a route of their own to be observable.
@Controller('probe')
class ProbeController {
  @Get()
  probe(): { probed: true } {
    return { probed: true };
  }
}

describe('throttling (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  // A fresh app per test, because the throttler's buckets are state that
  // outlives a single request.
  beforeEach(async () => {
    app = await createE2eApp({
      imports: [AppModule],
      controllers: [ProbeController],
    });

    // INestApplication.getHttpServer is typed as any.
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  function probe(clientIp: string): request.Test {
    return request(server)
      .get('/api/v1/probe')
      .set('X-Forwarded-For', clientIp);
  }

  async function exhaustBucket(clientIp: string): Promise<void> {
    for (let attempt = 0; attempt < THROTTLE_LIMIT; attempt += 1) {
      await probe(clientIp).expect(200);
    }
  }

  it('answers the request past the limit with the documented envelope', async () => {
    await exhaustBucket('203.0.113.7');

    const response = await probe('203.0.113.7');

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({
      statusCode: 429,
      code: ErrorCode.TOO_MANY_REQUESTS,
      path: '/api/v1/probe',
    });

    const body = response.body as Record<string, unknown>;
    expect(typeof body.message).toBe('string');
    expect(body.requestId).toBe(response.headers[REQUEST_ID_HEADER]);
  });

  // Without `trust proxy` req.ip is the proxy's address for everyone, so the
  // first client through would spend the bucket for all of them.
  it('gives each forwarded client a bucket of its own', async () => {
    await exhaustBucket('203.0.113.7');
    await probe('203.0.113.7').expect(429);

    await probe('198.51.100.4').expect(200);
  });

  it('does not throttle the liveness probe', async () => {
    for (let attempt = 0; attempt < THROTTLE_LIMIT + 2; attempt += 1) {
      await request(server).get('/health').expect(200);
    }
  });
});
