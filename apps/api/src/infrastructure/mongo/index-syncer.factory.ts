import { Connection, ConnectionStates } from 'mongoose';
import { PinoLogger } from 'nestjs-pino';

// What the two lines say. Each collection names its own, because "records will
// not expire on their own" and "snapshots will not expire on their own" are
// what an operator greps for.
export interface IndexSyncMessages {
  // Logged at info once the collection's indexes match the schema.
  synced: string;
  // Warned when they could not be reconciled. A missing TTL index costs an
  // unbounded collection rather than an outage, so this must not take the boot
  // down with it.
  failed: string;
}

export interface IndexSyncer {
  // Reconciles now if the connection is already open, and again on every
  // connect after that.
  start(): void;
}

// Everything this needs of a model. Declared structurally rather than as
// `Model<T>` so one syncer serves collections with different documents without
// a type parameter that nothing here would use.
interface IndexedModel {
  syncIndexes(): Promise<unknown>;
}

// Mongoose's own automatic index build is off (see the connection options): it
// runs while the connection is still opening, fails with buffering disabled,
// and swallows the rejection, which would leave a TTL index quietly missing on
// a collection nothing else prunes. This is the step that replaces it, and it
// is the same step for every collection that has one — the two that exist
// differ only in the two sentences they log.
//
// `syncIndexes` rather than `createIndexes` because the expiry is
// configuration: changing a TTL on an existing deployment makes the index
// differ from the schema, which `createIndexes` answers with an options
// conflict and this reconciles. Each collection belongs to this service alone,
// so dropping what the schema no longer declares is the wanted end state.
export function createIndexSyncer(
  model: IndexedModel,
  connection: Connection,
  logger: PinoLogger,
  messages: IndexSyncMessages,
): IndexSyncer {
  async function sync(): Promise<void> {
    try {
      await model.syncIndexes();
      logger.info(messages.synced);
    } catch (error) {
      logger.warn({ err: error }, messages.failed);
    }
  }

  return {
    // Both paths are needed: the connection is normally still opening when the
    // app finishes booting, and it is already open when a retry got there
    // first.
    start(): void {
      connection.on('connected', () => {
        void sync();
      });

      if (connection.readyState === ConnectionStates.connected) {
        void sync();
      }
    },
  };
}
