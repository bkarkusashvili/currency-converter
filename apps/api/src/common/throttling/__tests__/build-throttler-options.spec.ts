import type { TypedConfigService } from '../../../config/typed-config.service';
import { buildThrottlerOptions } from '../build-throttler-options';

const MILLISECONDS_PER_SECOND = 1000;

function createConfig(values: Record<string, number>): TypedConfigService {
  return {
    get: (key: string): unknown => values[key],
  } as unknown as TypedConfigService;
}

describe('buildThrottlerOptions', () => {
  it('turns the configured window into the milliseconds the throttler counts in', () => {
    const options = buildThrottlerOptions(
      createConfig({ THROTTLE_TTL_SECONDS: 60, THROTTLE_LIMIT: 42 }),
    );

    expect(options).toMatchObject({
      throttlers: [{ ttl: 60 * MILLISECONDS_PER_SECOND, limit: 42 }],
    });
  });

  it('reads both bounds from the configuration rather than a default', () => {
    const options = buildThrottlerOptions(
      createConfig({ THROTTLE_TTL_SECONDS: 1, THROTTLE_LIMIT: 5 }),
    );

    expect(options).toMatchObject({
      throttlers: [{ ttl: MILLISECONDS_PER_SECOND, limit: 5 }],
    });
  });

  it('answers a spent limit with a message that says nothing about the caller', () => {
    const options = buildThrottlerOptions(
      createConfig({ THROTTLE_TTL_SECONDS: 60, THROTTLE_LIMIT: 60 }),
    );

    expect(options.errorMessage).toBe('Too many requests, please retry later');
  });
});
