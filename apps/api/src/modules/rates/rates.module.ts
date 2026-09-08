import { Module } from '@nestjs/common';
import { LoggingModule } from '../../common/logging/logging.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { RatesService } from './application/rates.service';
import { RATES_REPOSITORY } from './domain/rates-repository.token';
import { MonobankModule } from './infrastructure/monobank/monobank.module';
import { RedisRatesRepository } from './infrastructure/redis-rates.repository';
import { RatesController } from './rates.controller';

@Module({
  // MonobankModule is what binds RATES_PROVIDER, so swapping the rate source is
  // this one import. The repository is bound here because it is the only
  // adapter the module owns directly.
  imports: [MonobankModule, RedisModule, LoggingModule],
  controllers: [RatesController],
  providers: [
    RatesService,
    { provide: RATES_REPOSITORY, useClass: RedisRatesRepository },
  ],
  // Conversion and currencies read the snapshot through the same service, so
  // they share its cache and its single flight rather than fetching again.
  //
  // MonobankModule is re-exported so the health indicator can inject the
  // breaker the provider trips without importing this module's infrastructure
  // folder: which adapter is wired stays a decision of the line above. Nest
  // re-exports modules rather than individual tokens, so the module is what
  // travels; MONOBANK_CIRCUIT_BREAKER and RATES_PROVIDER are all it exports.
  exports: [RatesService, MonobankModule],
})
export class RatesModule {}
