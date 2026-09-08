import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RatesUnavailableError } from '../../../common/errors/rates-unavailable.error';
import { RatesLookup } from '../domain/rates-lookup';
import type { RatesProvider } from '../domain/rates-provider.port';
import { RATES_PROVIDER } from '../domain/rates-provider.token';
import type { RatesRepository } from '../domain/rates-repository.port';
import { RATES_REPOSITORY } from '../domain/rates-repository.token';
import { RatesSnapshot } from '../domain/rates-snapshot';
import { describeRatesFailure } from './describe-rates-failure';

@Injectable()
export class RatesService {
  private inFlight: Promise<RatesSnapshot> | null = null;

  constructor(
    @Inject(RATES_PROVIDER) private readonly provider: RatesProvider,
    @Inject(RATES_REPOSITORY) private readonly repository: RatesRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RatesService.name);
  }

  async getSnapshot(): Promise<RatesLookup> {
    const fresh = await this.repository.getFresh();

    if (fresh !== null) {
      return { snapshot: fresh, source: 'cache' };
    }

    try {
      return { snapshot: await this.refresh(), source: 'provider' };
    } catch (error) {
      return this.serveStale(error);
    }
  }

  invalidate(): Promise<void> {
    return this.repository.clear();
  }

  // One upstream call per miss however many callers arrive during it: on a
  // source that allows one request a minute, a burst that each fetched for
  // itself would spend the whole budget on a single cache expiry.
  private refresh(): Promise<RatesSnapshot> {
    this.inFlight ??= this.fetchAndCache().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async fetchAndCache(): Promise<RatesSnapshot> {
    const snapshot = await this.provider.fetchRates();
    await this.repository.save(snapshot);

    return snapshot;
  }

  private async serveStale(error: unknown): Promise<RatesLookup> {
    const reason = describeRatesFailure(error);
    const stale = await this.repository.getStale();

    if (stale !== null) {
      this.logger.warn(
        { err: error },
        `Serving stale rates fetched at ${stale.fetchedAt}: ${reason}`,
      );

      return { snapshot: stale, source: 'stale-cache' };
    }

    this.logger.error(
      { err: error },
      `Exchange rates are unavailable: ${reason}`,
    );

    throw new RatesUnavailableError({ reason });
  }
}
