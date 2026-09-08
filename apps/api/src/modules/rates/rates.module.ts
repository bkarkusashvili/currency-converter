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
  exports: [RatesService],
})
export class RatesModule {}
