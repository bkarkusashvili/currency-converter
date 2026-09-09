import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters';
import { LoggingModule } from './common/logging';
import { ThrottlingModule } from './common/throttling';
import { validationPipeOptions } from './common/validation';
import { AppConfigModule } from './config/app-config.module';
import { MongoModule } from './infrastructure/mongo/mongo.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { ConversionModule } from './modules/conversion';
import { CurrenciesModule } from './modules/currencies';
import { HealthModule } from './modules/health';
import { HistoryModule } from './modules/history';
import { RatesModule } from './modules/rates';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    ThrottlingModule,
    RedisModule,
    MongoModule,
    RatesModule,
    ConversionModule,
    CurrenciesModule,
    HistoryModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useValue: new ValidationPipe(validationPipeOptions) },
  ],
})
export class AppModule {}
