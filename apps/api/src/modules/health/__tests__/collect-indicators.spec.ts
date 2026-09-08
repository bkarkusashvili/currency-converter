import { HealthIndicatorResult } from '@nestjs/terminus';
import { collectIndicators } from '../collect-indicators';
import type { HealthIndicatorPort } from '../health-indicator.port';

function indicator(result: HealthIndicatorResult): HealthIndicatorPort {
  return { check: () => Promise.resolve(result) };
}

describe('collectIndicators', () => {
  it('answers with the indicators it was injected, in the order they arrived', () => {
    const redis = indicator({ redis: { status: 'up' } });
    const mongodb = indicator({ mongodb: { status: 'up' } });

    expect(collectIndicators(redis, mongodb)).toStrictEqual([redis, mongodb]);
  });

  // The controller runs whatever the token holds, so an empty registration is
  // an app that reports ok rather than one that fails to boot.
  it('answers with nothing when nothing is registered', () => {
    expect(collectIndicators()).toStrictEqual([]);
  });
});
