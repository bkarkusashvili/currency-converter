import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStates, Model, Types } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import { HistoryUnavailableError } from '../../../common/errors/history-unavailable.error';
import { TimeoutError } from '../../../common/utils/timeout.error';
import { withTimeout } from '../../../common/utils/with-timeout';
import type { TypedConfigService } from '../../../config/typed-config.service';
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
    @Inject(ConfigService) private readonly config: TypedConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MongoHistoryRepository.name);
  }

  // The guard is the whole point of the write path: with buffering disabled the
  // driver would still spend the server-selection budget looking for a replica
  // set member before failing, and that budget is time a conversion the client
  // is waiting for would spend on a record it does not read back.
  //
  // The deadline is the other half of it. `readyState` reports the topology
  // mongoose last observed, so for up to two heartbeats after a server goes
  // away the guard passes and the write pays server selection anyway — and a
  // server that answers slowly is never disconnected at all. Past the deadline
  // this is the same outage as a connection that is down, reported the same
  // once-per-outage way rather than once per conversion.
  async record(entry: NewConversionRecord): Promise<void> {
    if (!this.isConnected()) {
      this.reportDroppedRecords();

      return;
    }

    try {
      await withTimeout(this.model.create(entry), this.operationTimeoutMs());
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.reportDroppedRecords();
      } else {
        this.logger.warn(
          { err: error },
          'Conversion history write failed, dropping the record',
        );
      }

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

    const documents = await this.read(limit);

    return documents.map((document) => this.toRecord(document));
  }

  // A read that outlives the deadline is the same answer as a store that is
  // down, and it is the documented one: letting a TimeoutError through would
  // make the service log an unexpected failure at error level once per request
  // for as long as the database is slow.
  private async read(limit: number): Promise<StoredConversionRecord[]> {
    try {
      return await withTimeout(
        this.model
          .find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean<StoredConversionRecord[]>()
          .exec(),
        this.operationTimeoutMs(),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new HistoryUnavailableError({ reason: 'timeout' });
      }

      throw error;
    }
  }

  private operationTimeoutMs(): number {
    return this.config.get('HISTORY_OPERATION_TIMEOUT_MS', { infer: true });
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
