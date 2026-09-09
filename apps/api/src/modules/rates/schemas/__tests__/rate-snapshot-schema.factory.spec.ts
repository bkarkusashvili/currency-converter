import { fakeConfig } from '../../../../config/__tests__/fake-config';
import { buildConfiguredRateSnapshotSchema } from '../rate-snapshot-schema.factory';

const SECONDS_PER_DAY = 86_400;

describe('buildConfiguredRateSnapshotSchema', () => {
  // The retention is configuration and this is the only step that reads it: a
  // schema built from a default would expire days on a schedule the deployment
  // never asked for — and the retention is also the window /rates/history can
  // be asked about, so the two would disagree.
  it('expires a day after the configured number of days', () => {
    const schema = buildConfiguredRateSnapshotSchema(
      fakeConfig({ RATES_ARCHIVE_TTL_DAYS: 30 }),
    );
    const [, options] = schema.indexes()[0] ?? [];

    expect(options).toMatchObject({
      expireAfterSeconds: 30 * SECONDS_PER_DAY,
    });
  });
});
