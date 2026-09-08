import { Schema as MongooseSchema } from 'mongoose';
import type { TypedConfigService } from '../../../config/typed-config.service';
import {
  buildConversionRecordSchema,
  ConversionRecordDocument,
} from './conversion-record.schema';

// The retention is configuration, so the schema is built per deployment rather
// than imported as a constant. This is the step that reads it, kept out of the
// module for the same reason the others are: the module declares the wiring and
// this decides what the wiring is given.
export function buildConfiguredConversionRecordSchema(
  config: TypedConfigService,
): MongooseSchema<ConversionRecordDocument> {
  return buildConversionRecordSchema(
    config.get('HISTORY_TTL_DAYS', { infer: true }),
  );
}
