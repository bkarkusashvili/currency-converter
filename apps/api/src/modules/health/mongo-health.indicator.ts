import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Connection, ConnectionStates } from 'mongoose';
import { HealthIndicatorPort } from './health-indicator.interface';
import { pingIndicator } from './ping-indicator.util';

const INDICATOR_KEY = 'mongodb';

@Injectable()
export class MongoHealthIndicator implements HealthIndicatorPort {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly health: HealthIndicatorService,
  ) {}

  check(): Promise<HealthIndicatorResult> {
    const indicator = this.health.check(INDICATOR_KEY);
    const db = this.connection.db;

    // The state is checked first because a command issued while the connection
    // is not up reports the driver's own complaint rather than the fact that
    // there is nothing to command.
    if (this.connection.readyState !== ConnectionStates.connected || !db) {
      return Promise.resolve(indicator.down({ reason: 'not connected' }));
    }

    return pingIndicator(indicator, db.admin().ping());
  }
}
