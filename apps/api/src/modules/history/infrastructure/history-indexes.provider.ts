import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import {
  createIndexSyncer,
  IndexSyncer,
} from '../../../infrastructure/mongo/index-syncer.factory';
import {
  CONVERSION_RECORD_MODEL,
  ConversionRecordDocument,
} from '../schemas/conversion-record.schema';

// The `conversions` collection's half of the index sync: which model, and the
// two sentences an operator reads. Why it is done here at all rather than left
// to mongoose is in the factory.
@Injectable()
export class HistoryIndexes implements OnApplicationBootstrap {
  private readonly syncer: IndexSyncer;

  constructor(
    @InjectModel(CONVERSION_RECORD_MODEL)
    model: Model<ConversionRecordDocument>,
    @InjectConnection() connection: Connection,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(HistoryIndexes.name);
    this.syncer = createIndexSyncer(model, connection, this.logger, {
      synced: 'Conversion history indexes are in place',
      failed:
        'Conversion history indexes could not be reconciled; records will not expire on their own',
    });
  }

  onApplicationBootstrap(): void {
    this.syncer.start();
  }
}
