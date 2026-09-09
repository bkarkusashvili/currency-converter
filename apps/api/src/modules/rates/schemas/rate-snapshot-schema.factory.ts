import { Schema as MongooseSchema } from 'mongoose';
import type { TypedConfigService } from '../../../config/typed-config.service';
import {
  buildRateSnapshotSchema,
  RateSnapshotDocument,
} from './rate-snapshot.schema';

// The retention is configuration, so the schema is built per deployment rather
// than imported as a constant. This is the step that reads it, kept out of the
// module for the same reason the others are: the module declares the wiring and
// this decides what the wiring is given.
export function buildConfiguredRateSnapshotSchema(
  config: TypedConfigService,
): MongooseSchema<RateSnapshotDocument> {
  return buildRateSnapshotSchema(
    config.get('RATES_ARCHIVE_TTL_DAYS', { infer: true }),
  );
}
