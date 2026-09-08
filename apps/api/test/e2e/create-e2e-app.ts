import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { setupSwagger } from '../../src/common/swagger/setup-swagger';
import type { TypedConfigService } from '../../src/config/typed-config.service';
import { configureHttp } from '../../src/configure-http';
import { overrideHistory } from './override-history';
import { overrideMongo } from './override-mongo';

interface E2eAppOptions {
  withSwagger?: boolean;
  // Where a suite swaps a provider out — the Redis client for its fake, the
  // rates provider for a stub. It runs on the builder rather than on the
  // metadata so a suite can override what AppModule wired without restating it.
  // It runs last, so a suite can replace the defaults below with its own
  // instances and watch them fail.
  customise?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

// Every suite boots through the same steps main.ts takes, so what is under test
// is the HTTP surface the process actually serves rather than a bare Nest app.
export async function createE2eApp(
  metadata: ModuleMetadata,
  { withSwagger = false, customise }: E2eAppOptions = {},
): Promise<INestApplication> {
  // Mongo is swapped out for every suite rather than by each one: a conversion
  // now writes a history record on its way out, and a suite that forgot would
  // be reaching for a database over the network to answer /convert.
  const builder = overrideHistory(
    overrideMongo(Test.createTestingModule(metadata)),
  );
  const moduleRef = await (customise?.(builder) ?? builder).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });

  app.useLogger(app.get(Logger));
  configureHttp(app, app.get<TypedConfigService>(ConfigService));

  if (withSwagger) {
    setupSwagger(app);
  }

  await app.init();

  return app;
}
