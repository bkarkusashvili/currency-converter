import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStates, Model, Types } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import { HistoryUnavailableError } from '../../../common/errors/history-unavailable.error';
import { ConversionRecord } from '../domain/conversion-record';
import type { NewConversionRecord } from '../domain/conversion-record';
import { HistoryRepository } from '../domain/history-repository.port';
import {
  CONVERSION_RECORD_MODEL,
  ConversionRecordDocument,
} from '../schemas/conversion-record.schema';

type StoredConversionRecord = ConversionRecordDocument & {
  _id: Types.ObjectId;
};

@Injectable()
export class MongoHistoryRepository implements HistoryRepository {
  private dropReported = false;

  constructor(
    @InjectModel(CONVERSION_RECORD_MODEL)
    private readonly model: Model<ConversionRecordDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MongoHistoryRepository.name);
  }

  // The guard is the whole point of the write path: with buffering disabled the
  // driver would still spend the server-selection budget looking for a replica
  // set member before failing, and that budget is time a conversion the client
  // is waiting for would spend on a record it does not read back.
  async record(entry: NewConversionRecord): Promise<void> {
    if (!this.isConnected()) {
      this.reportDroppedRecords();

      return;
    }

    try {
      await this.model.create(entry);
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Conversion history write failed, dropping the record',
      );

      return;
    }

    this.reportRecordsResumed();
  }

  // The read has the opposite contract: /history has nothing to answer with, so
  // the failure travels to the client as the documented 503 rather than as an
  // empty page that reads like "you have never converted anything".
  async findRecent(limit: number): Promise<ConversionRecord[]> {
    if (!this.isConnected()) {
      throw new HistoryUnavailableError({ reason: 'connection not ready' });
    }

    const documents = await this.model
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<StoredConversionRecord[]>()
      .exec();

    return documents.map((document) => this.toRecord(document));
  }

  private isConnected(): boolean {
    return this.connection.readyState === ConnectionStates.connected;
  }

  // Once per outage, not once per conversion: a burst of traffic while Mongo is
  // down would otherwise write a warning per request and bury the one line that
  // says what is wrong.
  private reportDroppedRecords(): void {
    if (this.dropReported) {
      return;
    }

    this.dropReported = true;
    this.logger.warn(
      'MongoDB is not connected, conversions are answered but not recorded',
    );
  }

  // The other half of that pair, and it belongs to the write path: what closes
  // the outage is a record that was actually stored, not a connection that
  // happens to be up. Reading /history is not evidence a conversion would be
  // recorded, and answering one used to log a sentence about writes.
  private reportRecordsResumed(): void {
    if (!this.dropReported) {
      return;
    }

    this.dropReported = false;
    this.logger.info(
      'MongoDB is reachable again, conversions are being recorded',
    );
  }

  private toRecord(document: StoredConversionRecord): ConversionRecord {
    return {
      id: document._id.toString(),
      from: document.from,
      to: document.to,
      amount: document.amount,
      result: document.result,
      rate: document.rate,
      strategy: document.strategy,
      source: document.source,
      ratesTimestamp: document.ratesTimestamp,
      createdAt: document.createdAt.toISOString(),
    };
  }
}
