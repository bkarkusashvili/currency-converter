import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { CONVERSION_STRATEGY_NAMES } from '../../../common/conversion/conversion-strategy-name';
import type { ConversionStrategyName } from '../../../common/conversion/conversion-strategy-name';
import { RATES_SOURCES } from '../../rates/domain/exchange-rate';
import type { RatesSource } from '../../rates/domain/exchange-rate';

export const CONVERSION_RECORD_MODEL = 'ConversionRecord';
export const CONVERSIONS_COLLECTION = 'conversions';

const SECONDS_PER_DAY = 86_400;

@Schema({
  collection: CONVERSIONS_COLLECTION,
  // A record is written once and never touched again, so `updatedAt` would
  // only ever repeat `createdAt`, and the version key counts revisions that
  // cannot happen.
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class ConversionRecordDocument {
  @Prop({ required: true })
  from!: string;

  @Prop({ required: true })
  to!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  result!: number;

  @Prop({ required: true })
  rate!: number;

  // A union erases to no single runtime type, so these two name theirs: the
  // enum is what keeps a value §3 does not publish out of the collection.
  @Prop({ required: true, type: String, enum: CONVERSION_STRATEGY_NAMES })
  strategy!: ConversionStrategyName;

  @Prop({ required: true, type: String, enum: RATES_SOURCES })
  source!: RatesSource;

  // A Date, like `createdAt`, rather than the ISO string the domain publishes:
  // stored as text the two timestamps would not compare or sort against each
  // other, and "how stale were the rates" is exactly a subtraction of the two.
  // Mongoose casts the ISO string a conversion hands over on the way in, and
  // the adapter's mapper serialises it back on the way out.
  @Prop({ required: true, type: Date })
  ratesTimestamp!: Date;

  @Prop()
  createdAt!: Date;
}

export function buildConversionRecordSchema(
  ttlDays: number,
): MongooseSchema<ConversionRecordDocument> {
  const schema = SchemaFactory.createForClass(ConversionRecordDocument);

  // One index doing both jobs: a single-field index is read in either
  // direction, so the newest-first page /history serves and the expiry ride on
  // the same key. A second ascending index would cost a write on every insert
  // and buy nothing.
  //
  // The TTL is what keeps a demo collection from growing without bound — the
  // conversions are a log, nothing reads one from a month ago, and no operator
  // is going to prune this by hand.
  schema.index(
    { createdAt: -1 },
    { expireAfterSeconds: ttlDays * SECONDS_PER_DAY },
  );

  return schema;
}
