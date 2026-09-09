import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStates, Model } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import { ArchiveUnavailableError } from '../../../common/errors';
import { OutageReporter, createOutageReporter } from '../../../common/logging';
import { TimeoutError, withTimeout } from '../../../common/utils';
import type { TypedConfigService } from '../../../config/typed-config.service';
import { RatesSnapshot } from '../domain/exchange-rate.types';
import { MAX_RATE_HISTORY_DAYS } from '../domain/rate-history-window.constants';
import { ArchivedSnapshot } from '../domain/rate-history.types';
import { RatesArchive } from '../domain/rates-archive.interface';
import { toUtcDay, utcWindowStart } from '../domain/utc-day.util';
import {
  RATE_SNAPSHOT_MODEL,
  RateSnapshotDocument,
} from '../schemas/rate-snapshot.schema';

@Injectable()
export class MongoRatesArchiveRepository implements RatesArchive {
  // Once per outage, not once per fetch: the archive is written on the way out
  // of every upstream call, so a Mongo that is down would otherwise write a
  // warning per refresh and bury the one line that says what is wrong.
  //
  // What closes the outage is a snapshot that was actually stored, not a
  // connection that happens to be up: reading /rates/history is not evidence a
  // fetch would be archived, so only the write path clears this.
  private readonly outage: OutageReporter;

  constructor(
    @InjectModel(RATE_SNAPSHOT_MODEL)
    private readonly model: Model<RateSnapshotDocument>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(ConfigService) private readonly config: TypedConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MongoRatesArchiveRepository.name);
    this.outage = createOutageReporter(this.logger, {
      down: 'MongoDB is not connected, rate snapshots are served but not archived',
      restored: 'MongoDB is reachable again, rate snapshots are being archived',
    });
  }

  // The readiness guard and the deadline are the whole point of the write path,
  // for the reasons §9 gives the history: with buffering disabled the driver
  // still spends the server-selection budget looking for a replica-set member
  // before failing, `readyState` reports the topology mongoose last observed
  // rather than the one that exists, and a server that answers slowly is never
  // disconnected at all. Between them the archive cannot hold a response open
  // for longer than one operation timeout, which is what "the write does not
  // block the answer" means here.
  //
  // Upsert on the day key rather than insert: the contract is one document per
  // UTC day holding that day's latest snapshot, and the fetch that runs at
  // 23:59 is as much today's rates as the one that ran at 00:01.
  async save(snapshot: RatesSnapshot): Promise<boolean> {
    if (!this.isConnected()) {
      this.outage.report();

      return false;
    }

    const fetchedAt = new Date(snapshot.fetchedAt);

    try {
      await withTimeout(
        this.model
          .updateOne(
            { _id: toUtcDay(fetchedAt) },
            { $set: { fetchedAt, rates: snapshot.rates } },
            // An update runs no validators unless it is asked to, so without
            // this the schema would describe the collection rather than
            // constrain it: an upsert is the only way anything is written here.
            { upsert: true, runValidators: true },
          )
          .exec(),
        this.operationTimeoutMs(),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.outage.report();
      } else {
        this.logger.warn(
          { err: error },
          'Rate snapshot archive write failed, dropping the day',
        );
      }

      return false;
    }

    this.outage.clear();

    // A deadline that expired stops the wait without cancelling the write, so
    // `false` means "not archived as far as this request could tell" rather
    // than "certainly not stored": a dropped day can still land afterwards.
    return true;
  }

  // The reads have the opposite contract: an empty answer and an unreachable
  // store are different facts, and only one of them is "the pair was never
  // published" (§3).
  async findLatest(): Promise<ArchivedSnapshot | null> {
    this.requireConnection();

    const [document] = await this.read(
      this.model.find().sort({ _id: -1 }).limit(1),
    );

    return document === undefined ? null : toArchived(document);
  }

  async findWindow(days: number): Promise<ArchivedSnapshot[]> {
    this.requireConnection();

    // The DTO already rejects anything outside the range, so this is not
    // validation: it is the adapter refusing to build a query it cannot bound.
    // Everything else that reaches the port — a future caller, a job, a test —
    // gets the same ceiling rather than the whole collection.
    const from = utcWindowStart(
      Math.min(days, MAX_RATE_HISTORY_DAYS),
      new Date(),
    );

    // Oldest first, off the `_id` index alone: a UTC day key sorts
    // lexicographically in date order, which is why the collection needs no
    // second index to answer this.
    const documents = await this.read(
      this.model.find({ _id: { $gte: from } }).sort({ _id: 1 }),
    );

    return documents.map(toArchived);
  }

  // A read that outlives the deadline is the same answer as a store that is
  // down, and it is the documented one: letting a TimeoutError through would
  // make the service log an unexpected failure at error level once per request
  // for as long as the database is slow.
  private async read(
    query: ReturnType<Model<RateSnapshotDocument>['find']>,
  ): Promise<RateSnapshotDocument[]> {
    try {
      return await withTimeout(
        query.lean<RateSnapshotDocument[]>().exec(),
        this.operationTimeoutMs(),
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new ArchiveUnavailableError({ reason: 'timeout' });
      }

      throw error;
    }
  }

  private requireConnection(): void {
    if (!this.isConnected()) {
      throw new ArchiveUnavailableError({ reason: 'connection not ready' });
    }
  }

  private operationTimeoutMs(): number {
    return this.config.get('RATES_ARCHIVE_OPERATION_TIMEOUT_MS', {
      infer: true,
    });
  }

  private isConnected(): boolean {
    return this.connection.readyState === ConnectionStates.connected;
  }
}

// The day key is the identity of the document, so the domain shape is the
// document with `_id` read as what it is: a date. `fetchedAt` leaves as the ISO
// string the rest of the domain speaks, even though the collection holds a BSON
// date — the same trade the history adapter makes.
function toArchived(document: RateSnapshotDocument): ArchivedSnapshot {
  return {
    date: document._id,
    fetchedAt: document.fetchedAt.toISOString(),
    rates: document.rates.map((rate) => ({
      base: rate.base,
      quote: rate.quote,
      ...(rate.buy === undefined ? {} : { buy: rate.buy }),
      ...(rate.sell === undefined ? {} : { sell: rate.sell }),
      ...(rate.cross === undefined ? {} : { cross: rate.cross }),
      date: rate.date,
    })),
  };
}
