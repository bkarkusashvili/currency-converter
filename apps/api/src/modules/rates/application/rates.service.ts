import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RatesUnavailableError } from '../../../common/errors/rates-unavailable.error';
import { RatesLookup, RatesSnapshot } from '../domain/exchange-rate';
import { RATES_PROVIDER, RATES_REPOSITORY } from '../domain/ports';
import type { RatesProvider, RatesRepository } from '../domain/ports';
import { describeRatesFailure } from './describe-rates-failure';

// A fetch and what caching it cost: the snapshot the upstream answered with,
// and whether the write of it degraded. Both halves belong to the same flight,
// so concurrent callers share the report as they share the snapshot.
interface RefreshedSnapshot {
  snapshot: RatesSnapshot;
  degraded: boolean;
}

@Injectable()
export class RatesService {
  private inFlight: Promise<RefreshedSnapshot> | null = null;

  constructor(
    @Inject(RATES_PROVIDER) private readonly provider: RatesProvider,
    @Inject(RATES_REPOSITORY) private readonly repository: RatesRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RatesService.name);
  }

  async getSnapshot(): Promise<RatesLookup> {
    const fresh = await this.repository.getFresh();

    if (fresh.snapshot !== null) {
      return {
        snapshot: fresh.snapshot,
        source: 'cache',
        cacheDegraded: fresh.degraded,
      };
    }

    try {
      const refreshed = await this.refresh();

      return {
        snapshot: refreshed.snapshot,
        source: 'provider',
        // Either half of the round trip can have failed on its own: a read that
        // could not be served and a write that could not be stored are the same
        // outage to the client and the same warning on the answer.
        cacheDegraded: fresh.degraded || refreshed.degraded,
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

  private async fetchAndCache(): Promise<RefreshedSnapshot> {
    const snapshot = await this.provider.fetchRates();
    const { degraded } = await this.repository.save(snapshot);

    return { snapshot, degraded };
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
        source: 'stale-cache',
        cacheDegraded: cacheDegraded || stale.degraded,
      };
    }

    this.logger.error(
      { err: error },
      `Exchange rates are unavailable: ${reason}`,
    );

    throw new RatesUnavailableError({ reason });
  }
}
