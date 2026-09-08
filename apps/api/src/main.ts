import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger/setup-swagger';
import type { TypedConfigService } from './config/typed-config.service';
import { configureHttp } from './configure-http';
import { listenOrExit } from './listen-or-exit';

async function bootstrap(): Promise<void> {
  // Startup logs are buffered until the pino logger takes over, so nothing is
  // emitted in the wrong format or lost before the logger is resolved.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<TypedConfigService>(ConfigService);

  configureHttp(app, config);

  setupSwagger(app);

  app.enableShutdownHooks();

  await listenOrExit(app, config.get('PORT', { infer: true }));
}

bootstrap().catch((error: unknown) => {
  new NestLogger('Bootstrap').error(
    'Application failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
