import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Connection, ConnectionStates } from 'mongoose';
import { TimeoutError } from '../../common/utils/timeout.error';
import { withTimeout } from '../../common/utils/with-timeout';
import { HealthIndicatorPort } from './health-indicator.port';

const INDICATOR_KEY = 'mongodb';

// A probe is not a request: a database that takes a second to answer a ping is
// already down as far as this report is concerned, and waiting for the driver's
// own server-selection budget would hold the probe open past the interval an
// orchestrator polls at.
const PING_TIMEOUT_MS = 500;

@Injectable()
export class MongoHealthIndicator implements HealthIndicatorPort {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly health: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check(INDICATOR_KEY);
    const db = this.connection.db;

    // The state is checked first because a command issued while the connection
    // is not up reports the driver's own complaint rather than the fact that
    // there is nothing to command.
    if (this.connection.readyState !== ConnectionStates.connected || !db) {
      return indicator.down({ reason: 'not connected' });
    }

    try {
      await withTimeout(db.admin().ping(), PING_TIMEOUT_MS);
    } catch (error) {
      // Which of the two it was, and nothing else: a mongoose message names the
      // host and, when the url carries one, the password, and this report is
      // served to anyone who can reach /health.
      return indicator.down({
        reason: error instanceof TimeoutError ? 'timeout' : 'ping failed',
      });
    }

    return indicator.up();
  }
}
