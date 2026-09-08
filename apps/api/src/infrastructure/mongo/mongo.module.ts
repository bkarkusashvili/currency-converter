import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggingModule } from '../../common/logging/logging.module';
import { MongoConnection } from './mongo-connection';
import { buildMongooseOptions } from './mongoose.options';

// MongooseModule registers the connection globally, so a feature module binds
// its own models with MongooseModule.forFeature and does not import this one.
// What lives here is the lifecycle around that connection: the state changes it
// logs and the retry mongoose does not do for a first attempt that failed.
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildMongooseOptions,
    }),
    LoggingModule,
  ],
  providers: [MongoConnection],
})
export class MongoModule {}
