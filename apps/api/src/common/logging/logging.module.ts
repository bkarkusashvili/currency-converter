import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerParams } from './build-logger-params.util';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildLoggerParams,
    }),
  ],
  // Re-exported so PinoLogger can be injected by app-level providers such as
  // GlobalExceptionFilter.
  exports: [LoggerModule],
})
export class LoggingModule {}
