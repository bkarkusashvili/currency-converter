import { fakeConfig } from '../../../config/__tests__/fake-config';
import { buildThrottlerOptions } from '../build-throttler-options.util';

const MILLISECONDS_PER_SECOND = 1000;

describe('buildThrottlerOptions', () => {
  it('turns the configured window into the milliseconds the throttler counts in', () => {
    const options = buildThrottlerOptions(
      fakeConfig({ THROTTLE_TTL_SECONDS: 60, THROTTLE_LIMIT: 42 }),
    );

    expect(options).toMatchObject({
      throttlers: [{ ttl: 60 * MILLISECONDS_PER_SECOND, limit: 42 }],
    });
  });

  it('reads both bounds from the configuration rather than a default', () => {
    const options = buildThrottlerOptions(
      fakeConfig({ THROTTLE_TTL_SECONDS: 1, THROTTLE_LIMIT: 5 }),
    );

    expect(options).toMatchObject({
      throttlers: [{ ttl: MILLISECONDS_PER_SECOND, limit: 5 }],
    });
  });

  it('answers a spent limit with a message that says nothing about the caller', () => {
    const options = buildThrottlerOptions(
      fakeConfig({ THROTTLE_TTL_SECONDS: 60, THROTTLE_LIMIT: 60 }),
    );

    expect(options.errorMessage).toBe('Too many requests, please retry later');
  });
});
