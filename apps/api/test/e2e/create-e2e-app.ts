import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import type { TypedConfigService } from '../../src/config/typed-config.service';
import { configureHttp } from '../../src/configure-http';

// Every suite boots through the same steps main.ts takes, so what is under test
// is the HTTP surface the process actually serves rather than a bare Nest app.
export async function createE2eApp(
  metadata: ModuleMetadata,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule(metadata).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });

  app.useLogger(app.get(Logger));
  configureHttp(app, app.get<TypedConfigService>(ConfigService));

  await app.init();

  return app;
}
