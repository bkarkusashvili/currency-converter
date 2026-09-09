import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import {
  createIndexSyncer,
  IndexSyncer,
} from '../../../infrastructure/mongo/index-syncer.factory';
import {
  RATE_SNAPSHOT_MODEL,
  RateSnapshotDocument,
} from '../schemas/rate-snapshot.schema';

// The `rate_snapshots` collection's half of the index sync, on the same terms
// as the history's: which model, and the two sentences an operator reads. The
// expiry here is RATES_ARCHIVE_TTL_DAYS, which is configuration, which is why
// the factory reconciles rather than creates.
@Injectable()
export class RatesArchiveIndexes implements OnApplicationBootstrap {
  private readonly syncer: IndexSyncer;

  constructor(
    @InjectModel(RATE_SNAPSHOT_MODEL)
    model: Model<RateSnapshotDocument>,
    @InjectConnection() connection: Connection,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RatesArchiveIndexes.name);
    this.syncer = createIndexSyncer(model, connection, this.logger, {
      synced: 'Rate snapshot archive indexes are in place',
      failed:
        'Rate snapshot archive indexes could not be reconciled; snapshots will not expire on their own',
    });
  }

  onApplicationBootstrap(): void {
    this.syncer.start();
  }
}
