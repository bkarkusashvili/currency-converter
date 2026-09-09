import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStates, Model } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import {
  CONVERSION_RECORD_MODEL,
  ConversionRecordDocument,
} from '../schemas/conversion-record.schema';

// Mongoose's own automatic index build is off (see the connection options): it
// runs while the connection is still opening, fails with buffering disabled,
// and swallows the rejection, which would leave the TTL index quietly missing
// on a collection nothing else prunes. Doing it here makes the step observable
// and gives it a connection that is actually open.
@Injectable()
export class HistoryIndexes implements OnApplicationBootstrap {
  constructor(
    @InjectModel(CONVERSION_RECORD_MODEL)
    private readonly model: Model<ConversionRecordDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(HistoryIndexes.name);
  }

  // Both paths are needed: the connection is normally still opening when the
  // app finishes booting, and it is already open when a retry got there first.
  onApplicationBootstrap(): void {
    this.connection.on('connected', () => {
      void this.sync();
    });

    if (this.connection.readyState === ConnectionStates.connected) {
      void this.sync();
    }
  }

  // syncIndexes rather than createIndexes because the expiry is configuration:
  // changing HISTORY_TTL_DAYS on an existing deployment makes the index differ
  // from the schema, which createIndexes answers with an options conflict and
  // this reconciles. The collection belongs to this service alone, so dropping
  // what the schema no longer declares is the wanted end state.
  private async sync(): Promise<void> {
    try {
      await this.model.syncIndexes();
      this.logger.info('Conversion history indexes are in place');
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Conversion history indexes could not be reconciled; records will not expire on their own',
      );
    }
  }
}
