import { ConnectOptions } from 'mongoose';
import type { TypedConfigService } from '../../config/typed-config.service';

// The options a mongoose connection to this deployment is opened with, shared
// by the module's first attempt and by every retry after it.
export function buildMongoConnectOptions(
  config: TypedConfigService,
): ConnectOptions {
  return {
    // Mongo is not a hard dependency (§2): a command issued while the
    // connection is not up has to fail now rather than sit in mongoose's
    // buffer until it times out, holding a conversion open behind it.
    bufferCommands: false,
    serverSelectionTimeoutMS: config.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', {
      infer: true,
    }),
    // Index creation is an explicit step this module owns instead. With
    // buffering off mongoose's own autoIndex runs while the connection is still
    // opening, fails, and is swallowed — the TTL index would silently never
    // exist. Same for the collection, which the first insert creates anyway.
    autoIndex: false,
    autoCreate: false,
  };
}
