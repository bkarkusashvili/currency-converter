import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { firstValueFrom } from 'rxjs';
import { CircuitBreaker } from '../../../../common/resilience/circuit-breaker';
import { retry } from '../../../../common/resilience/retry';
import { withTimeout } from '../../../../common/utils/with-timeout';
import type { TypedConfigService } from '../../../../config/typed-config.service';
import { MONOBANK_CIRCUIT_BREAKER } from './monobank-circuit-breaker.factory';
import { RatesProvider } from '../../domain/ports';
import { RatesSnapshot } from '../../domain/exchange-rate';
import { monobankRatesSchema } from './monobank-rate.schema';
import { mapMonobankRates } from './monobank-rates.mapper';
import { shouldRetryMonobank } from './should-retry-monobank';

// Ceiling for the jittered backoff. Monobank allows one request a minute, so
// retrying is there to ride out a blip, not to wait out an outage: past a
// couple of seconds the stale cache is the better answer.
const MAX_RETRY_DELAY_MS = 2000;

@Injectable()
export class MonobankRatesProvider implements RatesProvider {
  constructor(
    private readonly http: HttpService,
    @Inject(ConfigService) private readonly config: TypedConfigService,
    @Inject(MONOBANK_CIRCUIT_BREAKER) private readonly breaker: CircuitBreaker,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MonobankRatesProvider.name);
  }

  // The breaker wraps the retries rather than the other way round, so an
  // exhausted call counts as one failure against the threshold instead of
  // tripping the circuit on a single bad minute.
  //
  // The budget wraps the retries in turn. MONOBANK_TIMEOUT_MS bounds a single
  // request, so the attempts and the backoff between them add up to far longer
  // than any of them, and single-flight makes every concurrent caller wait out
  // the same sum — for a stale copy that was already in Redis when the first
  // one arrived. Inside the breaker, so an expired budget counts as the
  // upstream failure it is rather than passing through unnoticed.
  fetchRates(): Promise<RatesSnapshot> {
    return this.breaker.execute(() =>
      withTimeout(
        retry(() => this.requestSnapshot(), {
          attempts: this.config.get('MONOBANK_RETRY_ATTEMPTS', { infer: true }),
          baseDelayMs: this.config.get('MONOBANK_RETRY_BASE_DELAY_MS', {
            infer: true,
          }),
          maxDelayMs: MAX_RETRY_DELAY_MS,
          shouldRetry: shouldRetryMonobank,
        }),
        this.config.get('MONOBANK_TOTAL_BUDGET_MS', { infer: true }),
      ),
    );
  }

  private async requestSnapshot(): Promise<RatesSnapshot> {
    const url = this.config.get('MONOBANK_API_URL', { infer: true });
    const response = await firstValueFrom(this.http.get<unknown>(url));

    return {
      fetchedAt: new Date().toISOString(),
      rates: mapMonobankRates(
        monobankRatesSchema.parse(response.data),
        this.logger,
      ),
    };
  }
}
