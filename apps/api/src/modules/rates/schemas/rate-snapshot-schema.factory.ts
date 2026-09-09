import { Schema as MongooseSchema } from 'mongoose';
import type { TypedConfigService } from '../../../config/typed-config.service';
import { MAX_RATE_HISTORY_DAYS } from '../domain/rate-history-window.constants';
import {
  buildRateSnapshotSchema,
  RateSnapshotDocument,
} from './rate-snapshot.schema';

// The retention is configuration, so the schema is built per deployment rather
// than imported as a constant. This is the step that reads it, kept out of the
// module for the same reason the others are: the module declares the wiring and
// this decides what the wiring is given.
//
// It is also where the one relation between the two numbers is checked. The
// route accepts a window of up to MAX_RATE_HISTORY_DAYS days and the TTL index
// built here decides how many days exist to answer it with: a retention shorter
// than the window is a route that advertises days the collection has already
// expired and answers them as the gaps §3 reserves for an outage. Nothing else
// reads both numbers, so nothing else could catch it — and a deployment that
// gets this wrong should not start rather than quietly serve a shorter history
// than it documents.
export function buildConfiguredRateSnapshotSchema(
  config: TypedConfigService,
): MongooseSchema<RateSnapshotDocument> {
  const ttlDays = config.get('RATES_ARCHIVE_TTL_DAYS', { infer: true });

  if (ttlDays < MAX_RATE_HISTORY_DAYS) {
    throw new Error(
      `RATES_ARCHIVE_TTL_DAYS is ${ttlDays}, shorter than the ` +
        `${MAX_RATE_HISTORY_DAYS} days GET /rates/history accepts as a window ` +
        `(MAX_RATE_HISTORY_DAYS). Every day between the two would be a day the ` +
        `route accepts and the TTL index has already deleted, answered as a gap. ` +
        `Raise RATES_ARCHIVE_TTL_DAYS to at least ${MAX_RATE_HISTORY_DAYS}, or ` +
        `lower MAX_RATE_HISTORY_DAYS to match the retention.`,
    );
  }

  return buildRateSnapshotSchema(ttlDays);
}
