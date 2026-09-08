import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildSwaggerConfig } from './common/swagger/build-swagger-config';
import { readPackageMetadata } from './common/swagger/read-package-metadata';
import type { TypedConfigService } from './config/typed-config.service';
import { DOCS_JSON_PATH, DOCS_PATH, configureHttp } from './configure-http';

async function bootstrap(): Promise<void> {
  // Startup logs are buffered until the pino logger takes over, so nothing is
  // emitted in the wrong format or lost before the logger is resolved.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<TypedConfigService>(ConfigService);

  configureHttp(app, config);

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
