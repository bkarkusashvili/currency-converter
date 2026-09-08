import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import type { TypedConfigService } from '../../../config/typed-config.service';
import { REDIS_CLIENT } from '../../../infrastructure/redis/redis-client.token';
import { RatesRepository } from '../domain/rates-repository.port';
import { RatesSnapshot } from '../domain/rates-snapshot';
import { cachedRatesSnapshotSchema } from './cached-rates-snapshot.schema';
import { RATES_CACHE_KEYS } from './rates-cache-keys';

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

  getFresh(): Promise<RatesSnapshot | null> {
    return this.read(RATES_CACHE_KEYS.fresh);
  }

  getStale(): Promise<RatesSnapshot | null> {
    return this.read(RATES_CACHE_KEYS.stale);
  }

  // Both keys are written in one round trip: two separate calls could leave the
  // fallback holding an older snapshot than the fresh key it is meant to back.
  async save(snapshot: RatesSnapshot): Promise<void> {
    const value = JSON.stringify(snapshot);

    try {
      const results = await this.client
        .pipeline()
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

      // A command that fails on a live connection comes back as an entry error
      // rather than a rejection, so an unchecked exec reports a write that
      // never happened as a success.
      const failure = results?.find(([error]) => error !== null)?.[0];

      if (failure) {
        this.degrade('save', failure);
      }
    } catch (error) {
      this.degrade('save', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.del(RATES_CACHE_KEYS.fresh, RATES_CACHE_KEYS.stale);
    } catch (error) {
      this.degrade('clear', error);
    }
  }

  private async read(key: string): Promise<RatesSnapshot | null> {
    let raw: string | null;

    try {
      raw = await this.client.get(key);
    } catch (error) {
      this.degrade(`read of ${key}`, error);

      return null;
    }

    if (raw === null) {
      return null;
    }

    const parsed = cachedRatesSnapshotSchema.safeParse(parseJson(raw));

    if (!parsed.success) {
      this.logger.warn(`Discarding a corrupt cache value at ${key}`);

      return null;
    }

    return parsed.data;
  }

  // Redis is a cache, not a hard dependency: a failure slows the next request
  // down to an upstream call, it does not fail one.
  private degrade(operation: string, error: unknown): void {
    this.logger.warn(
      `Rates cache ${operation} failed, degrading: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
