import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

export const RATE_SNAPSHOT_MODEL = 'RateSnapshot';
export const RATE_SNAPSHOTS_COLLECTION = 'rate_snapshots';

const SECONDS_PER_DAY = 86_400;

// One published pair, stored exactly as the upstream quoted it: a spread, or a
// mid rate, never both (§5). Re-deriving either on the way in would make the
// archive a second opinion about what Monobank said rather than a record of it.
@Schema({ _id: false, versionKey: false })
export class ArchivedRateDocument {
  @Prop({ required: true })
  base!: string;

  @Prop({ required: true })
  quote!: string;

  @Prop()
  buy?: number;

  @Prop()
  sell?: number;

  @Prop()
  cross?: number;

  @Prop({ required: true })
  date!: string;
}

const archivedRateSchema = SchemaFactory.createForClass(ArchivedRateDocument);

// A day of rates, keyed by the UTC day itself rather than by a generated id:
// the key *is* the uniqueness rule the contract states, so "at most one
// document per day" is enforced by the primary index instead of by whoever
// remembers to write the upsert filter correctly. The day's document is
// replaced by every fetch inside it, so it always holds that day's latest
// snapshot.
@Schema({
  collection: RATE_SNAPSHOTS_COLLECTION,
  // Both timestamps would only ever restate `fetchedAt`, which is the field
  // that matters: it is the upstream fetch, not the write.
  timestamps: false,
  versionKey: false,
})
export class RateSnapshotDocument {
  // 'YYYY-MM-DD', UTC.
  @Prop({ type: String, required: true })
  _id!: string;

  // A Date rather than the ISO string the domain publishes: stored as text it
  // would not compare against a TTL index at all, and the expiry below is what
  // keeps the collection bounded.
  @Prop({ required: true, type: Date })
  fetchedAt!: Date;

  @Prop({ required: true, type: [archivedRateSchema] })
  rates!: ArchivedRateDocument[];
}

export function buildRateSnapshotSchema(
  ttlDays: number,
): MongooseSchema<RateSnapshotDocument> {
  const schema = SchemaFactory.createForClass(RateSnapshotDocument);

  // The only index this collection needs beyond `_id`. The day key is already
  // indexed, sorts lexicographically in date order and is what both reads use
  // — the newest day and the window — so nothing here rides on `fetchedAt`
  // except the expiry.
  //
  // Without it the archive grows by a document a day forever, and the one that
  // prunes it is nobody: RATES_ARCHIVE_TTL_DAYS is both the retention and the
  // widest window /rates/history can honestly answer.
  schema.index(
    { fetchedAt: 1 },
    { expireAfterSeconds: ttlDays * SECONDS_PER_DAY },
  );

  return schema;
}
