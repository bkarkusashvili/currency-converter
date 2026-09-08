import { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createE2eApp } from './create-e2e-app';

// One of the origins the default CORS_ORIGINS list carries: the Vite dev server
// the web app runs on.
const ALLOWED_ORIGIN = 'http://localhost:5173';
const DISALLOWED_ORIGIN = 'https://not-our-app.example';

describe('HTTP hardening (e2e)', () => {
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

  describe('helmet', () => {
    it('tells the browser not to sniff the content type', async () => {
      const response = await request(server).get('/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sends a content security policy that admits the Swagger UI', async () => {
      const response = await request(server).get('/health').expect(200);
      const policy = response.headers['content-security-policy'];

      expect(policy).toEqual(expect.any(String));
      expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    });

    it('stops advertising the framework behind the API', async () => {
      const response = await request(server).get('/health').expect(200);

      expect(response.headers).not.toHaveProperty('x-powered-by');
    });

    it('hardens the error envelope too, not only the happy path', async () => {
      const response = await request(server)
        .get('/api/v1/does-not-exist')
        .expect(404);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('CORS', () => {
    it('echoes an origin from the configured list', async () => {
      const response = await request(server)
        .get('/health')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(
        ALLOWED_ORIGIN,
      );
    });

    it('answers the preflight for one of them', async () => {
      const response = await request(server)
        .options('/api/v1/does-not-exist')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBeLessThan(300);
      expect(response.headers['access-control-allow-origin']).toBe(
        ALLOWED_ORIGIN,
      );
    });

    // The browser is what enforces this: with no header the response is never
    // handed to the calling page.
    it('does not allow an origin outside the list', async () => {
      const response = await request(server)
        .get('/health')
        .set('Origin', DISALLOWED_ORIGIN)
        .expect(200);

      expect(response.headers).not.toHaveProperty(
        'access-control-allow-origin',
      );
    });

    it('does not allow it on the preflight either', async () => {
      const response = await request(server)
        .options('/api/v1/does-not-exist')
        .set('Origin', DISALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers).not.toHaveProperty(
        'access-control-allow-origin',
      );
    });
  });
});
