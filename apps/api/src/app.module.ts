import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingModule } from './common/logging/logging.module';
import { ThrottlingModule } from './common/throttling/throttling.module';
import { validationPipeOptions } from './common/validation/validation-pipe.options';
import { AppConfigModule } from './config/app-config.module';

@Module({
  imports: [AppConfigModule, LoggingModule, ThrottlingModule],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useValue: new ValidationPipe(validationPipeOptions) },
  ],
})
export class AppModule {}
