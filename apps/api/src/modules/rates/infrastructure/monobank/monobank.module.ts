import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingModule } from '../../../../common/logging/logging.module';
import { MONOBANK_CIRCUIT_BREAKER } from '../../domain/monobank-circuit-breaker.token';
import { RATES_PROVIDER } from '../../domain/rates-provider.token';
import { buildMonobankCircuitBreaker } from './monobank-circuit-breaker.factory';
import { buildMonobankHttpOptions } from './monobank-http.options';
import { MonobankRatesProvider } from './monobank-rates.provider';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: buildMonobankHttpOptions,
    }),
    LoggingModule,
  ],
  providers: [
    {
      provide: MONOBANK_CIRCUIT_BREAKER,
      inject: [ConfigService],
      useFactory: buildMonobankCircuitBreaker,
    },
    { provide: RATES_PROVIDER, useClass: MonobankRatesProvider },
  ],
  // The breaker is exported so the health indicator reports the state of the
  // instance the provider actually trips; RatesModule re-exports it, which is
  // how the indicator reaches it without importing this module.
  exports: [RATES_PROVIDER, MONOBANK_CIRCUIT_BREAKER],
})
export class MonobankModule {}
