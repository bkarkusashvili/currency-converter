import { INestApplication } from '@nestjs/common';
import type { Application } from 'express';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/logging/request-id.middleware';
import type { TypedConfigService } from './config/typed-config.service';

export const GLOBAL_PREFIX = 'api/v1';
export const HEALTH_PATH = 'health';
export const HEALTH_LIVE_PATH = 'health/live';
export const DOCS_PATH = 'docs';
export const DOCS_JSON_PATH = 'docs-json';

// Shared by main.ts and the e2e suite so both exercise the same HTTP surface
// and the routing contract cannot drift between them.
export function configureHttp(
  app: INestApplication,
  config: TypedConfigService,
): void {
  // Express only reads the client address out of X-Forwarded-For when it is
  // told how far down the chain to trust. Without it everyone behind nginx or
  // Railway collapses into the proxy's address: one throttle bucket for every
  // client, and a request log naming the load balancer. Nest types the
  // adapter's instance as `any`.
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));

  // First in the chain: Nest registers its body parser after everything here
  // and before any module middleware, so a request that dies in the parser
  // still has an id to report and to log under.
  app.use(requestIdMiddleware);

  app.use(
    helmet({
      // Swagger UI is the only HTML this service serves and it boots from an
      // inline script. Every other response is JSON, where CSP does not apply.
      contentSecurityPolicy: {
        directives: { 'script-src': ["'self'", "'unsafe-inline'"] },
      },
    }),
  );

  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }) });

  // Health and the docs stay unversioned so probes and tooling keep working
  // across future API versions. The exclusions match a path exactly, so the
  // liveness route needs its own entry: excluding `health` does not cover
  // anything below it.
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: [HEALTH_PATH, HEALTH_LIVE_PATH, DOCS_PATH, DOCS_JSON_PATH],
  });
}
