import mongoose from 'mongoose';
import {
  buildRateSnapshotSchema,
  RateSnapshotDocument,
  RATE_SNAPSHOTS_COLLECTION,
} from '../rate-snapshot.schema';

const TTL_DAYS = 90;
const SECONDS_PER_DAY = 86_400;

const DOCUMENT = {
  _id: '2026-09-08',
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    {
      base: 'USD',
      quote: 'UAH',
      buy: 44.35,
      sell: 44.831,
      date: '2026-09-08T11:00:00.000Z',
    },
    {
      base: 'BTC',
      quote: 'USD',
      cross: 60756.2,
      date: '2026-09-08T11:00:00.000Z',
    },
  ],
};

// A model compiled off the default mongoose instance validates without a
// server, which is what lets the schema be tested rather than described.
function validate(name: string, document: Record<string, unknown>): unknown {
  const model = mongoose.model<RateSnapshotDocument>(
    name,
    buildRateSnapshotSchema(TTL_DAYS),
  );

  return new model(document as unknown as RateSnapshotDocument).validateSync();
}

describe('buildRateSnapshotSchema', () => {
  const schema = buildRateSnapshotSchema(TTL_DAYS);

  it('writes into the rate_snapshots collection', () => {
    expect(schema.get('collection')).toBe(RATE_SNAPSHOTS_COLLECTION);
  });

  // `fetchedAt` is the timestamp that matters and it is already stored; a
  // createdAt would only say when the write happened to run.
  it('stamps nothing of its own', () => {
    expect(schema.get('timestamps')).toBeFalsy();
    expect(schema.get('versionKey')).toBe(false);
  });

  // The day key is the uniqueness rule the contract states, enforced by the
  // primary index rather than by whoever remembers to write the upsert filter.
  it('keys a document by the UTC day rather than by a generated id', () => {
    expect(schema.path('_id').instance).toBe('String');
  });

  describe('indexes', () => {
    it('expires a day after the configured retention', () => {
      const [key, options] = schema.indexes()[0]!;

      expect(key).toStrictEqual({ fetchedAt: 1 });
      expect(options).toMatchObject({
        expireAfterSeconds: TTL_DAYS * SECONDS_PER_DAY,
      });
    });

    it('follows the configured retention rather than a fixed one', () => {
      const [, options] = buildRateSnapshotSchema(7).indexes()[0]!;

      expect(options).toMatchObject({
        expireAfterSeconds: 7 * SECONDS_PER_DAY,
      });
    });

    // Both reads ride on `_id`, which a day key already sorts in date order,
    // so the expiry is the only index this collection needs beyond it.
    it('adds nothing beyond the expiry', () => {
      expect(schema.indexes()).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('accepts a day of rates as the provider published them', () => {
      expect(validate('RateSnapshotAccepts', { ...DOCUMENT })).toBeUndefined();
    });

    // Stored as text `fetchedAt` would not compare against a TTL index at all,
    // and the expiry is what keeps the collection bounded.
    it('casts the fetch timestamp to a date', () => {
      const model = mongoose.model<RateSnapshotDocument>(
        'RateSnapshotCasts',
        buildRateSnapshotSchema(TTL_DAYS),
      );

      const document = new model({
        ...DOCUMENT,
      } as unknown as RateSnapshotDocument);

      expect(document.fetchedAt).toBeInstanceOf(Date);
      expect(document.fetchedAt.toISOString()).toBe(DOCUMENT.fetchedAt);
    });

    it('rejects a day with no fetch timestamp', () => {
      expect(
        validate('RateSnapshotRequires', { _id: '2026-09-08', rates: [] }),
      ).toBeDefined();
    });

    it('rejects a rate with no pair', () => {
      expect(
        validate('RateSnapshotRequiresPair', {
          ...DOCUMENT,
          rates: [{ buy: 44.35, date: '2026-09-08T11:00:00.000Z' }],
        }),
      ).toBeDefined();
    });
  });
});
