import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggingModule } from '../../common/logging/logging.module';
import type { TypedConfigService } from '../../config/typed-config.service';
import { HISTORY_REPOSITORY } from './domain/history-repository.token';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { HistoryIndexes } from './infrastructure/history-indexes';
import { MongoHistoryRepository } from './infrastructure/mongo-history.repository';
import {
  buildConversionRecordSchema,
  CONVERSION_RECORD_MODEL,
} from './schemas/conversion-record.schema';

// The retention is configuration, so the schema is built per deployment rather
// than imported as a constant; forFeatureAsync is what lets it read the config.
@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: CONVERSION_RECORD_MODEL,
        inject: [ConfigService],
        useFactory: (config: TypedConfigService) =>
          buildConversionRecordSchema(
            config.get('HISTORY_TTL_DAYS', { infer: true }),
          ),
      },
    ]),
    LoggingModule,
  ],
  controllers: [HistoryController],
  providers: [
    HistoryService,
    HistoryIndexes,
    { provide: HISTORY_REPOSITORY, useClass: MongoHistoryRepository },
  ],
  // The conversion records what it answered through this service, and nothing
  // outside the module reaches the repository.
  exports: [HistoryService],
})
export class HistoryModule {}
