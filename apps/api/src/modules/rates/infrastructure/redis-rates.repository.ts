import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { CacheUnavailableError } from '../../../common/errors/cache-unavailable.error';
import type { TypedConfigService } from '../../../config/typed-config.service';
import { REDIS_CLIENT } from '../../../infrastructure/redis/create-redis-client';
import { CachedSnapshot, CacheWrite, RatesRepository } from '../domain/ports';
import { RatesSnapshot } from '../domain/exchange-rate';
import { cachedRatesSnapshotSchema } from './cached-rates-snapshot.schema';
import { RATES_CACHE_KEYS } from './rates-cache-keys';

// A cache that answered, with nothing to answer with. Kept beside the degraded
// case so the two ways of returning no snapshot are visibly different: this one
// is an expiry, and nobody needs to be told about it.
const MISS: CachedSnapshot = { snapshot: null, degraded: false };

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

@Injectable()
export class RedisRatesRepository implements RatesRepository {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    @Inject(ConfigService) private readonly config: TypedConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisRatesRepository.name);
  }

  getFresh(): Promise<CachedSnapshot> {
    return this.read(RATES_CACHE_KEYS.fresh);
  }

  getStale(): Promise<CachedSnapshot> {
    return this.read(RATES_CACHE_KEYS.stale);
  }

  // Both keys are written in one transaction: a pipeline buys the round trip
  // but not atomicity, so another instance's two SETs could land between these
  // and leave the fallback holding an older snapshot than the fresh key it is
  // meant to back.
  async save(snapshot: RatesSnapshot): Promise<CacheWrite> {
    const value = JSON.stringify(snapshot);

    try {
      const results = await this.client
        .multi()
        .set(
          RATES_CACHE_KEYS.fresh,
          value,
          'EX',
          this.config.get('RATES_CACHE_TTL_SECONDS', { infer: true }),
        )
        .set(
          RATES_CACHE_KEYS.stale,
          value,
          'EX',
          this.config.get('RATES_STALE_TTL_SECONDS', { infer: true }),
        )
        .exec();

      // Two ways a write is lost without the call rejecting: exec resolves null
      // when the transaction was aborted, and a command that failed on a live
      // connection comes back as an entry error. Read either as success and the
      // cache is reported written when it is not.
      const failure =
        results === null
          ? new Error('the transaction was aborted')
          : results.find(([error]) => error !== null)?.[0];

      if (failure) {
        this.degrade('save', failure);

        return { degraded: true };
      }
    } catch (error) {
      this.degrade('save', error);

      return { degraded: true };
    }

    return { degraded: false };
  }

  // The one method that does not degrade. An invalidation is a state change
  // the caller commanded rather than a read on the way to an answer, and the
  // only reason to command it is to force the next read to refetch: reporting
  // success for keys that are still there tells an operator the cache is empty
  // while the stale rates they were clearing keep being served.
  async clear(): Promise<void> {
    try {
      await this.client.del(RATES_CACHE_KEYS.fresh, RATES_CACHE_KEYS.stale);
    } catch (error) {
      this.logger.warn({ err: error }, 'Rates cache clear failed');

      throw new CacheUnavailableError({
        reason: 'the cache refused the command',
      });
    }
  }

  private async read(key: string): Promise<CachedSnapshot> {
    let raw: string | null;

    try {
      raw = await this.client.get(key);
    } catch (error) {
      this.degrade(`read of ${key}`, error);

      return { snapshot: null, degraded: true };
    }

    if (raw === null) {
      return MISS;
    }

    const parsed = cachedRatesSnapshotSchema.safeParse(parseJson(raw));

    // A cache that answered with something unreadable is not a cache that could
    // not be reached: the value is discarded and the request pays an upstream
    // call, which is exactly what an expiry costs.
    if (!parsed.success) {
      this.logger.warn(`Discarding a corrupt cache value at ${key}`);

      return MISS;
    }

    return { snapshot: parsed.data, degraded: false };
  }

  // Redis is a cache, not a hard dependency: a failure slows the next request
  // down to an upstream call, it does not fail one.
  private degrade(operation: string, error: unknown): void {
    this.logger.warn(
      { err: error },
      `Rates cache ${operation} failed, degrading`,
    );
  }
}
