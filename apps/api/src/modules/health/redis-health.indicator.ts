import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis-client.token';
import { HealthIndicatorPort } from './health-indicator.port';
import { pingIndicator } from './ping-indicator';

const INDICATOR_KEY = 'redis';

@Injectable()
export class RedisHealthIndicator implements HealthIndicatorPort {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly health: HealthIndicatorService,
  ) {}

  check(): Promise<HealthIndicatorResult> {
    return pingIndicator(this.health.check(INDICATOR_KEY), this.client.ping());
  }
}
