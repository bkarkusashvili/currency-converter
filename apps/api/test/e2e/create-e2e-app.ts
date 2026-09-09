import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { setupSwagger } from '../../src/common/swagger/setup-swagger.util';
import type { TypedConfigService } from '../../src/config/typed-config.service';
import { configureHttp } from '../../src/configure-http';
import { overrideHistory } from './override-history';
import { overrideMongo } from './override-mongo';
import { overrideRedis } from './override-redis';

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
  // Every out-of-process dependency is swapped out for every suite rather than
  // by each one: /health reports the cache and the database, and a conversion
  // writes a history record on its way out, so a suite that forgot one would be
  // reaching over the network to answer /convert. `customise` runs last and an
  // override is last-wins, so a suite that wants to watch one of them fail
  // still passes its own instance and gets it.
  const builder = overrideRedis(
    overrideHistory(overrideMongo(Test.createTestingModule(metadata))),
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
