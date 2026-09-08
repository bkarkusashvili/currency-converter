import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerModuleOptions,
  seconds,
} from '@nestjs/throttler';
import { TypedConfigService } from '../../config/typed-config.service';

function buildThrottlerOptions(
  config: TypedConfigService,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        ttl: seconds(config.get('THROTTLE_TTL_SECONDS', { infer: true })),
        limit: config.get('THROTTLE_LIMIT', { infer: true }),
      },
    ],
    errorMessage: 'Too many requests, please retry later',
  };
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildThrottlerOptions,
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ThrottlingModule {}
