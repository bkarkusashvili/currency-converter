import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './common/swagger/build-swagger-config';
import { readPackageMetadata } from './common/swagger/read-package-metadata';
import type { TypedConfigService } from './config/typed-config.service';

const GLOBAL_PREFIX = 'api/v1';
const DOCS_PATH = 'docs';
const DOCS_JSON_PATH = 'docs-json';

async function bootstrap(): Promise<void> {
  // Startup logs are buffered until the pino logger takes over, so nothing is
  // emitted in the wrong format or lost before the logger is resolved.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<TypedConfigService>(ConfigService);

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

  const document = SwaggerModule.createDocument(
    app,
    buildSwaggerConfig(readPackageMetadata()),
  );
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: DOCS_JSON_PATH,
  });

  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  new NestLogger('Bootstrap').error(
    'Application failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
