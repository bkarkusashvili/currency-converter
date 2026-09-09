import mongoose from 'mongoose';
import { NewConversionRecord } from '../../domain/conversion-record.types';
import {
  buildConversionRecordSchema,
  ConversionRecordDocument,
  CONVERSIONS_COLLECTION,
} from '../conversion-record.schema';

const TTL_DAYS = 30;
const SECONDS_PER_DAY = 86_400;

const ENTRY: NewConversionRecord = {
  from: 'EUR',
  to: 'GBP',
  amount: 100,
  result: 85.09,
  rate: 0.850942,
  strategy: 'cross',
  source: 'cache',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
};

// A model compiled off the default mongoose instance validates without a
// server, which is what lets the schema be tested rather than described.
function validate(name: string, document: Record<string, unknown>): unknown {
  const model = mongoose.model<ConversionRecordDocument>(
    name,
    buildConversionRecordSchema(TTL_DAYS),
  );

  return new model(
    document as unknown as ConversionRecordDocument,
  ).validateSync();
}

describe('buildConversionRecordSchema', () => {
  const schema = buildConversionRecordSchema(TTL_DAYS);

  it('writes into the conversions collection', () => {
    expect(schema.get('collection')).toBe(CONVERSIONS_COLLECTION);
  });

  // The record is written once and never touched, so an updatedAt would only
  // repeat createdAt and a version key would count revisions that cannot happen.
  it('stamps only the creation time', () => {
    expect(schema.get('timestamps')).toStrictEqual({
      createdAt: true,
      updatedAt: false,
    });
    expect(schema.get('versionKey')).toBe(false);
  });

  describe('indexes', () => {
    it('expires a record after the configured number of days', () => {
      const [key, options] = schema.indexes()[0]!;

      expect(key).toStrictEqual({ createdAt: -1 });
      expect(options).toMatchObject({
        expireAfterSeconds: TTL_DAYS * SECONDS_PER_DAY,
      });
    });

    it('follows the configured retention rather than a fixed one', () => {
      const [, options] = buildConversionRecordSchema(7).indexes()[0]!;

      expect(options).toMatchObject({
        expireAfterSeconds: 7 * SECONDS_PER_DAY,
      });
    });

    // A single-field index is read in either direction, so the newest-first
    // page and the expiry share one; a second would cost a write per insert.
    it('serves the newest-first read from that same index', () => {
      expect(schema.indexes()).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('accepts the record a conversion produces', () => {
      expect(validate('ConversionRecordAccepts', { ...ENTRY })).toBeUndefined();
    });

    // The domain publishes an ISO string and the collection holds a BSON date,
    // like `createdAt`. Stored as text the two would neither sort nor compare
    // against each other, and "how stale were the rates" is their difference.
    it('casts the rates timestamp to a date', () => {
      const model = mongoose.model<ConversionRecordDocument>(
        'ConversionRecordCasts',
        buildConversionRecordSchema(TTL_DAYS),
      );

      const document = new model({
        ...ENTRY,
      } as unknown as ConversionRecordDocument);

      expect(document.ratesTimestamp).toBeInstanceOf(Date);
      expect(document.ratesTimestamp.toISOString()).toBe(ENTRY.ratesTimestamp);
    });

    it('rejects a record with a field missing', () => {
      expect(
        validate('ConversionRecordRequires', { from: 'EUR' }),
      ).toBeDefined();
    });

    // The strategy and the source are published enums; a value outside them
    // would reach a client that is typed against §3.
    it('rejects a strategy the API cannot have priced with', () => {
      expect(
        validate('ConversionRecordEnum', { ...ENTRY, strategy: 'guesswork' }),
      ).toBeDefined();
    });
  });
});
