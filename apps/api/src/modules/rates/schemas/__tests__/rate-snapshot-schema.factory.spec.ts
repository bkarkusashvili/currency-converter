import { fakeConfig } from '../../../../config/__tests__/fake-config';
import { MAX_RATE_HISTORY_DAYS } from '../../domain/rate-history-window.constants';
import { buildConfiguredRateSnapshotSchema } from '../rate-snapshot-schema.factory';

const SECONDS_PER_DAY = 86_400;

describe('buildConfiguredRateSnapshotSchema', () => {
  // The retention is configuration and this is the only step that reads it: a
  // schema built from a default would expire days on a schedule the deployment
  // never asked for.
  it('expires a day after the configured number of days', () => {
    const schema = buildConfiguredRateSnapshotSchema(
      fakeConfig({ RATES_ARCHIVE_TTL_DAYS: MAX_RATE_HISTORY_DAYS }),
    );
    const [, options] = schema.indexes()[0] ?? [];

    expect(options).toMatchObject({
      expireAfterSeconds: MAX_RATE_HISTORY_DAYS * SECONDS_PER_DAY,
    });
  });

  // A retention longer than the window is a deployment keeping more than the
  // route will ever serve, which is a decision rather than a mistake: the days
  // past the window are refused by the API, not by expiry.
  it('accepts a retention longer than the window the route answers', () => {
    expect(() =>
      buildConfiguredRateSnapshotSchema(
        fakeConfig({ RATES_ARCHIVE_TTL_DAYS: MAX_RATE_HISTORY_DAYS * 2 }),
      ),
    ).not.toThrow();
  });

  // The other way round is a route that advertises days the collection has
  // already deleted and answers them as the gaps §3 reserves for an outage.
  // Nothing else reads both numbers, so this is the only place it can be caught
  // — and it is caught at boot rather than on the first request that asks for
  // an expired day.
  it('refuses to build a retention shorter than that window', () => {
    expect(() =>
      buildConfiguredRateSnapshotSchema(
        fakeConfig({ RATES_ARCHIVE_TTL_DAYS: MAX_RATE_HISTORY_DAYS - 1 }),
      ),
    ).toThrow(/RATES_ARCHIVE_TTL_DAYS is 89/);
  });

  it('names both numbers and what to do about them', () => {
    expect(() =>
      buildConfiguredRateSnapshotSchema(
        fakeConfig({ RATES_ARCHIVE_TTL_DAYS: 30 }),
      ),
    ).toThrow(
      new RegExp(
        `MAX_RATE_HISTORY_DAYS.*at least ${MAX_RATE_HISTORY_DAYS}`,
        's',
      ),
    );
  });
});
