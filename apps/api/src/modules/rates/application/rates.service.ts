import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RatesUnavailableError } from '../../../common/errors';
import { RatesLookup, RatesSnapshot } from '../domain/exchange-rate.types';
import { ArchivedSnapshot } from '../domain/rate-history.types';
import { RatesSource } from '../domain/rates-source.enum';
import { RATES_ARCHIVE } from '../domain/rates-archive.interface';
import type { RatesArchive } from '../domain/rates-archive.interface';
import { RATES_PROVIDER } from '../domain/rates-provider.interface';
import type { RatesProvider } from '../domain/rates-provider.interface';
import { RATES_REPOSITORY } from '../domain/rates-repository.interface';
import type { RatesRepository } from '../domain/rates-repository.interface';
import { describeRatesFailure } from './describe-rates-failure.util';

// A fetch and what storing it cost: the snapshot the upstream answered with,
// whether the cache write degraded and whether the archive write did. All three
// belong to the same flight, so concurrent callers share the report as they
// share the snapshot.
interface RefreshedSnapshot {
  snapshot: RatesSnapshot;
  degraded: boolean;
  archiveDegraded: boolean;
}

@Injectable()
export class RatesService {
  private inFlight: Promise<RefreshedSnapshot> | null = null;

  constructor(
    @Inject(RATES_PROVIDER) private readonly provider: RatesProvider,
    @Inject(RATES_REPOSITORY) private readonly repository: RatesRepository,
    @Inject(RATES_ARCHIVE) private readonly archive: RatesArchive,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RatesService.name);
  }

  // Four tiers, in the order §4 states them: the fresh key, the upstream, the
  // fallback key, and the newest archived day. Each is older than the one
  // before it and each says so on the response, so a client is never left
  // guessing how old the rates behind an answer are.
  async getSnapshot(): Promise<RatesLookup> {
    const fresh = await this.repository.getFresh();

    if (fresh.snapshot !== null) {
      return {
        snapshot: fresh.snapshot,
        source: RatesSource.Cache,
        cacheDegraded: fresh.degraded,
        // Nothing was fetched, so there was nothing to archive: a cache hit
        // must not report the archive as degraded for a write it never made.
        archiveDegraded: false,
      };
    }

    try {
      const refreshed = await this.refresh();

      return {
        snapshot: refreshed.snapshot,
        source: RatesSource.Provider,
        // Either half of the round trip can have failed on its own: a read that
        // could not be served and a write that could not be stored are the same
        // outage to the client and the same warning on the answer.
        cacheDegraded: fresh.degraded || refreshed.degraded,
        archiveDegraded: refreshed.archiveDegraded,
      };
    } catch (error) {
      return this.serveStale(error, fresh.degraded);
    }
  }

  invalidate(): Promise<void> {
    return this.repository.clear();
  }

  // One upstream call per miss however many callers arrive during it: on a
  // source that allows one request a minute, a burst that each fetched for
  // itself would spend the whole budget on a single cache expiry.
  private refresh(): Promise<RefreshedSnapshot> {
    this.inFlight ??= this.fetchAndCache().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  // Both writes are issued together rather than one after the other: they go to
  // different stores, neither reads the other, and serialising them would add
  // the archive's latency to every refresh for nothing.
  //
  // Both are awaited, and neither can hold the answer: the cache write is
  // bounded by REDIS_COMMAND_TIMEOUT_MS and the archive write by a readiness
  // guard and RATES_ARCHIVE_OPERATION_TIMEOUT_MS, and both degrade rather than
  // reject. That is what lets the response say what was lost — a write nobody
  // waited for could only ever be reported on the *next* request, by which
  // time the day it dropped is not the one the client was told about.
  private async fetchAndCache(): Promise<RefreshedSnapshot> {
    const snapshot = await this.provider.fetchRates();
    const [{ degraded }, archived] = await Promise.all([
      this.repository.save(snapshot),
      this.archive.save(snapshot),
    ]);

    return { snapshot, degraded, archiveDegraded: !archived };
  }

  private async serveStale(
    error: unknown,
    cacheDegraded: boolean,
  ): Promise<RatesLookup> {
    const reason = describeRatesFailure(error);
    const stale = await this.repository.getStale();

    if (stale.snapshot !== null) {
      this.logger.warn(
        { err: error },
        `Serving stale rates fetched at ${stale.snapshot.fetchedAt}: ${reason}`,
      );

      return {
        snapshot: stale.snapshot,
        source: RatesSource.StaleCache,
        cacheDegraded: cacheDegraded || stale.degraded,
        archiveDegraded: false,
      };
    }

    const archived = await this.readArchive();

    // Days old rather than hours, and priced against a market that has moved:
    // this is the answer of last resort, and the log says so at the level an
    // operator is paged on.
    if (archived !== null) {
      this.logger.warn(
        { err: error },
        `Serving archived rates fetched at ${archived.fetchedAt}: ${reason}`,
      );

      return {
        snapshot: { fetchedAt: archived.fetchedAt, rates: archived.rates },
        source: RatesSource.Archive,
        cacheDegraded: cacheDegraded || stale.degraded,
        // The archive answered this request; the flag is about a write, and
        // this branch made none.
        archiveDegraded: false,
      };
    }

    this.logger.error(
      { err: error },
      `Exchange rates are unavailable: ${reason}`,
    );

    throw new RatesUnavailableError({ reason });
  }

  // The archive is a fallback, so an archive that cannot be read is a fallback
  // that has nothing — not a second failure to report. The client is already
  // being told the rates are unavailable and why the upstream could not answer;
  // ARCHIVE_UNAVAILABLE is /rates/history's answer, where the archive is the
  // subject of the request rather than the last place left to look.
  private async readArchive(): Promise<ArchivedSnapshot | null> {
    try {
      return await this.archive.findLatest();
    } catch (error) {
      this.logger.warn(
        { err: error },
        'The rate snapshot archive could not be read for the final fallback',
      );

      return null;
    }
  }
}
