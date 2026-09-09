import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStates, Model, Types } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import { HistoryUnavailableError } from '../../../common/errors';
import { OutageReporter, createOutageReporter } from '../../../common/logging';
import { TimeoutError, withTimeout } from '../../../common/utils';
import type { TypedConfigService } from '../../../config/typed-config.service';
import { ConversionRecord } from '../domain/conversion-record.types';
import type { NewConversionRecord } from '../domain/conversion-record.types';
import { MAX_HISTORY_LIMIT } from '../domain/history-limits.constants';
import { HistoryRepository } from '../domain/history-repository.interface';
import {
  CONVERSION_RECORD_MODEL,
  ConversionRecordDocument,
} from '../schemas/conversion-record.schema';

type StoredConversionRecord = ConversionRecordDocument & {
  _id: Types.ObjectId;
};

@Injectable()
export class MongoHistoryRepository implements HistoryRepository {
  // Once per outage, not once per conversion: a burst of traffic while Mongo is
  // down would otherwise write a warning per request and bury the one line that
  // says what is wrong. The repeats say nothing at all, for the same reason.
  //
  // What closes the outage is a record that was actually stored, not a
  // connection that happens to be up: reading /history is not evidence a
  // conversion would be recorded, so only the write path clears this.
  private readonly outage: OutageReporter;

  constructor(
    @InjectModel(CONVERSION_RECORD_MODEL)
    private readonly model: Model<ConversionRecordDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(ConfigService) private readonly config: TypedConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MongoHistoryRepository.name);
    this.outage = createOutageReporter(this.logger, {
      down: 'MongoDB is not connected, conversions are answered but not recorded',
      restored: 'MongoDB is reachable again, conversions are being recorded',
    });
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
  async record(entry: NewConversionRecord): Promise<boolean> {
    if (!this.isConnected()) {
      this.outage.report();

      return false;
    }

    try {
      await withTimeout(this.model.create(entry), this.operationTimeoutMs());
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.outage.report();
      } else {
        this.logger.warn(
          { err: error },
          'Conversion history write failed, dropping the record',
        );
      }

      return false;
    }

    this.outage.clear();

    // A deadline that expired stops the wait without cancelling the write, so
    // `false` means "not recorded as far as this request could tell" rather
    // than "certainly not stored": a dropped record can still land afterwards.
    return true;
  }

  // The read has the opposite contract: /history has nothing to answer with, so
  // the failure travels to the client as the documented 503 rather than as an
  // empty page that reads like "you have never converted anything".
  async findRecent(limit: number): Promise<ConversionRecord[]> {
    if (!this.isConnected()) {
      throw new HistoryUnavailableError({ reason: 'connection not ready' });
    }

    // The DTO already rejects anything outside the range, so this is not
    // validation: it is the adapter refusing to build a query it cannot bound.
    // Everything else that reaches the port — a future caller, a job, a test —
    // gets the same page ceiling rather than a full collection scan.
    const documents = await this.read(Math.min(limit, MAX_HISTORY_LIMIT));

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
      ratesTimestamp: document.ratesTimestamp.toISOString(),
      createdAt: document.createdAt.toISOString(),
    };
  }
}
