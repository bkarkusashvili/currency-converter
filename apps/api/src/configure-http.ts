import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import type { TypedConfigService } from './config/typed-config.service';

export const GLOBAL_PREFIX = 'api/v1';
export const DOCS_PATH = 'docs';
export const DOCS_JSON_PATH = 'docs-json';

// Shared by main.ts and the e2e suite so both exercise the same HTTP surface
// and the routing contract cannot drift between them.
export function configureHttp(
  app: INestApplication,
  config: TypedConfigService,
): void {
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
  // across future API versions.
  app.setGlobalPrefix(GLOBAL_PREFIX, {
    exclude: ['health', DOCS_PATH, DOCS_JSON_PATH],
  });
}
