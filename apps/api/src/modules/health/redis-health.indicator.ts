import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { TimeoutError } from '../../common/utils/timeout.error';
import { withTimeout } from '../../common/utils/with-timeout';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis-client.token';
import { HealthIndicatorPort } from './health-indicator.port';

const INDICATOR_KEY = 'redis';

// A probe is not a request. The client's own retry window is measured for a
// command a user is waiting on; a cache that takes a second to answer PING is
// already down as far as this report is concerned, and waiting for it would
// hold the probe open past the interval the orchestrator polls at.
const PING_TIMEOUT_MS = 500;

@Injectable()
export class RedisHealthIndicator implements HealthIndicatorPort {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check(INDICATOR_KEY);

    try {
      await withTimeout(this.client.ping(), PING_TIMEOUT_MS);
    } catch (error) {
      // Which of the two it was, and nothing else: an ioredis message names the
      // host, the port and — with a password in the url — the credentials, and
      // this report is served to anyone who can reach /health.
      return indicator.down({
        reason: error instanceof TimeoutError ? 'timeout' : 'ping failed',
      });
    }

    return indicator.up();
  }
}
