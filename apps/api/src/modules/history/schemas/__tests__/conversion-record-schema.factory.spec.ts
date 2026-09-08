import { fakeConfig } from '../../../../config/__tests__/fake-config';
import { buildConfiguredConversionRecordSchema } from '../conversion-record-schema.factory';

const SECONDS_PER_DAY = 86_400;

describe('buildConfiguredConversionRecordSchema', () => {
  // The retention is configuration and this is the only step that reads it: a
  // schema built from a default would expire records on a schedule the
  // deployment never asked for.
  it('expires records after the configured number of days', () => {
    const schema = buildConfiguredConversionRecordSchema(
      fakeConfig({ HISTORY_TTL_DAYS: 7 }),
    );
    const [, options] = schema.indexes()[0] ?? [];

    expect(options).toMatchObject({
      expireAfterSeconds: 7 * SECONDS_PER_DAY,
    });
  });
});
