import { TestingModuleBuilder } from '@nestjs/testing';
import { FakeRedisClient } from '../../src/infrastructure/redis/__tests__/fake-redis-client';
import { REDIS_CLIENT } from '../../src/infrastructure/redis/create-redis-client.factory';

// /health reports the cache, so a suite with no Redis to talk to would be
// asserting on the runner rather than on the app — and would pass or fail
// depending on whether the developer happens to have a Redis running.
export function overrideRedis(
  builder: TestingModuleBuilder,
  client: FakeRedisClient = new FakeRedisClient(),
): TestingModuleBuilder {
  return builder.overrideProvider(REDIS_CLIENT).useValue(client.asRedis());
}
