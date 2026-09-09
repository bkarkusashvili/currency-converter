import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggingModule } from '../../common/logging';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { RateHistoryService } from './application/rate-history.service';
import { RatesService } from './application/rates.service';
import { RATES_ARCHIVE } from './domain/rates-archive.interface';
import { RATES_REPOSITORY } from './domain/rates-repository.interface';
import { MonobankModule } from './infrastructure/monobank/monobank.module';
import { MongoRatesArchiveRepository } from './infrastructure/mongo-rates-archive.repository';
import { RatesArchiveIndexes } from './infrastructure/rates-archive-indexes.provider';
import { RedisRatesRepository } from './infrastructure/redis-rates.repository';
import { RatesController } from './rates.controller';
import { buildConfiguredRateSnapshotSchema } from './schemas/rate-snapshot-schema.factory';
import { RATE_SNAPSHOT_MODEL } from './schemas/rate-snapshot.schema';

@Module({
  // MonobankModule is what binds RATES_PROVIDER, so swapping the rate source is
  // this one import. The two stores are bound here because they are the only
  // adapters the module owns directly.
  //
  // The archive retention is configuration, so its schema is built per
  // deployment rather than imported as a constant; forFeatureAsync is what lets
  // it read the config.
  imports: [
    MonobankModule,
    RedisModule,
    MongooseModule.forFeatureAsync([
      {
        name: RATE_SNAPSHOT_MODEL,
        inject: [ConfigService],
        useFactory: buildConfiguredRateSnapshotSchema,
      },
    ]),
    LoggingModule,
  ],
  controllers: [RatesController],
  providers: [
    RatesService,
    RateHistoryService,
    RatesArchiveIndexes,
    { provide: RATES_REPOSITORY, useClass: RedisRatesRepository },
    { provide: RATES_ARCHIVE, useClass: MongoRatesArchiveRepository },
  ],
  // Conversion and currencies read the snapshot through the same service, so
  // they share its cache, its single flight and its fallbacks rather than
  // fetching again. RateHistoryService is not exported: /rates/history is this
  // module's own surface and nothing outside it reads the archive.
  //
  // MonobankModule is re-exported so the health indicator can inject the
  // breaker the provider trips without importing this module's infrastructure
  // folder: which adapter is wired stays a decision of the lines above. Nest
  // re-exports modules rather than individual tokens, so the module is what
  // travels; MONOBANK_CIRCUIT_BREAKER and RATES_PROVIDER are all it exports.
  exports: [RatesService, MonobankModule],
})
export class RatesModule {}
