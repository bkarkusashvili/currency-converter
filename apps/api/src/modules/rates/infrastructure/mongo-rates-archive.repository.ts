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
import {
  ArchivedPairDay,
  ArchivedSnapshot,
  PublishedRate,
  RateHistoryQuery,
} from '../domain/rate-history.types';
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

    // The whole day, because this tier answers with the whole snapshot: it is
    // one document, and every pair in it is about to be priced against.
    const [document] = await this.withDeadline(
      this.model
        .find()
        .sort({ _id: -1 })
        .limit(1)
        .lean<RateSnapshotDocument[]>()
        .exec(),
    );

    return document === undefined ? null : toArchived(document);
  }

  // The window read, projected in the server. A day document holds the whole
  // published board and this answers three numbers of it, so `$filter` keeps
  // the one pair the request asked for and `$map` narrows it to those numbers;
  // the two `$anyElementTrue` flags carry what is left of the day that the
  // answer depends on — whether each code was quoted at all — so §3's three
  // outcomes are still decided from one read rather than from a second query
  // per code.
  async findPairWindow({
    base,
    quote,
    days,
  }: RateHistoryQuery): Promise<ArchivedPairDay[]> {
    this.requireConnection();

    // One clock reading for both ends of the range: two calls a millisecond
    // apart can straddle midnight and build a window that excludes its own
    // last day.
    const now = new Date();
    // The DTO already rejects anything outside the range, so neither bound is
    // validation: they are the adapter refusing to build a query it cannot
    // bound. Everything else that reaches the port — a future caller, a job, a
    // test — gets the same ceiling rather than the whole collection, and the
    // upper bound keeps a day written by a clock running ahead out of a window
    // that is supposed to end today.
    const from = utcWindowStart(Math.min(days, MAX_RATE_HISTORY_DAYS), now);

    // Oldest first, off the `_id` index alone: a UTC day key sorts
    // lexicographically in date order, which is why the collection needs no
    // second index to answer this. The `$limit` is the same refusal as the
    // clamp above, applied where a scan would otherwise be paid for: at most
    // one document per day exists, so the range can only exceed it if the
    // collection is not what the contract says it is.
    const projected = await this.withDeadline(
      this.model
        .aggregate<ProjectedPairDay>([
          { $match: { _id: { $gte: from, $lte: toUtcDay(now) } } },
          { $sort: { _id: 1 } },
          { $limit: MAX_RATE_HISTORY_DAYS },
          {
            $project: {
              _id: 1,
              rate: publishedPair(base, quote),
              quotesBase: quotesCode(base),
              quotesQuote: quotesCode(quote),
            },
          },
        ])
        .exec(),
    );

    return projected.map(toPairDay);
  }

  // A read that outlives the deadline is the same answer as a store that is
  // down, and it is the documented one: letting a TimeoutError through would
  // make the service log an unexpected failure at error level once per request
  // for as long as the database is slow.
  private async withDeadline<T>(operation: Promise<T>): Promise<T> {
    try {
      return await withTimeout(operation, this.operationTimeoutMs());
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

// What the aggregation above answers with: the day key, the pair's own numbers
// when the day published it, and the two membership flags.
interface ProjectedPairDay {
  _id: string;
  rate?: PublishedRate;
  quotesBase: boolean;
  quotesQuote: boolean;
}

// The pair, filtered inside the document. `$filter` keeps the entry published
// in exactly this orientation — `USD/UAH` is a pair and `UAH/USD` is not (§3)
// — and `$map` narrows it to the three numbers a point carries, so `base`,
// `quote` and the upstream `date` never leave the server. A day that published
// no such pair yields no element and `$first` leaves the field out entirely,
// which is what `rate === undefined` reads downstream.
function publishedPair(base: string, quote: string): Record<string, unknown> {
  return {
    $first: {
      $map: {
        input: {
          $filter: {
            input: '$rates',
            as: 'rate',
            cond: {
              $and: [
                { $eq: ['$$rate.base', base] },
                { $eq: ['$$rate.quote', quote] },
              ],
            },
          },
        },
        as: 'rate',
        // A missing field resolves to nothing rather than to null, so a spread
        // pair comes back without `cross` and a mid rate without `buy` and
        // `sell` — the same shape §5 stored.
        in: { buy: '$$rate.buy', sell: '$$rate.sell', cross: '$$rate.cross' },
      },
    },
  };
}

// Whether the day quoted the code at all, on either side of any pair it
// published. One boolean rather than the day's code list: it is everything the
// UNSUPPORTED_CURRENCY decision needs, and it costs one pass the server was
// already making over `rates`.
function quotesCode(code: string): Record<string, unknown> {
  return {
    $anyElementTrue: [
      {
        $map: {
          input: '$rates',
          as: 'rate',
          in: {
            $or: [
              { $eq: ['$$rate.base', code] },
              { $eq: ['$$rate.quote', code] },
            ],
          },
        },
      },
    ],
  };
}

// The day key is the identity of the document here too, so it leaves as the
// date the domain speaks of. `rate` is spread rather than assigned undefined:
// a day that did not publish the pair carries no key for it.
function toPairDay(document: ProjectedPairDay): ArchivedPairDay {
  return {
    date: document._id,
    ...(document.rate === undefined ? {} : { rate: document.rate }),
    quotesBase: document.quotesBase,
    quotesQuote: document.quotesQuote,
  };
}
