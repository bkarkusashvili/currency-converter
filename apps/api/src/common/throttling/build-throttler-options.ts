import {
  ThrottlerModuleOptions,
  ThrottlerOptions,
  seconds,
} from '@nestjs/throttler';
import { TypedConfigService } from '../../config/typed-config.service';

// ThrottlerModuleOptions is a union of a bare list of throttlers and the object
// form that carries the shared settings. Narrowing to the branch this factory
// builds is what lets a caller — and the spec — read errorMessage back off it.
type ThrottlerOptionsObject = Exclude<
  ThrottlerModuleOptions,
  ThrottlerOptions[]
>;

export function buildThrottlerOptions(
  config: TypedConfigService,
): ThrottlerOptionsObject {
  return {
    throttlers: [
      {
        // The throttler counts in milliseconds; the variable is documented and
        // configured in seconds.
        ttl: seconds(config.get('THROTTLE_TTL_SECONDS', { infer: true })),
        limit: config.get('THROTTLE_LIMIT', { infer: true }),
      },
    ],
    errorMessage: 'Too many requests, please retry later',
  };
}
