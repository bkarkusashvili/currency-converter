import { HttpModule, HttpModuleOptions } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingModule } from '../../../../common/logging/logging.module';
import { CircuitBreaker } from '../../../../common/resilience/circuit-breaker';
import type { TypedConfigService } from '../../../../config/typed-config.service';
import { MONOBANK_CIRCUIT_BREAKER } from '../../domain/monobank-circuit-breaker.token';
import { RATES_PROVIDER } from '../../domain/rates-provider.token';
import { MonobankRatesProvider } from './monobank-rates.provider';

function buildHttpOptions(config: TypedConfigService): HttpModuleOptions {
  return { timeout: config.get('MONOBANK_TIMEOUT_MS', { infer: true }) };
}

function buildCircuitBreaker(config: TypedConfigService): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: config.get('CIRCUIT_BREAKER_FAILURE_THRESHOLD', {
      infer: true,
    }),
    resetTimeoutMs: config.get('CIRCUIT_BREAKER_RESET_TIMEOUT_MS', {
      infer: true,
    }),
  });
}

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: buildHttpOptions,
    }),
    LoggingModule,
  ],
  providers: [
    {
      provide: MONOBANK_CIRCUIT_BREAKER,
      inject: [ConfigService],
      useFactory: buildCircuitBreaker,
    },
    { provide: RATES_PROVIDER, useClass: MonobankRatesProvider },
  ],
  // The breaker is exported so the health indicator reports the state of the
  // instance the provider actually trips; RatesModule re-exports it, which is
  // how the indicator reaches it without importing this module.
  exports: [RATES_PROVIDER, MONOBANK_CIRCUIT_BREAKER],
})
export class MonobankModule {}
