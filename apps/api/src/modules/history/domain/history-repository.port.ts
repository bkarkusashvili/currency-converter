import { ConversionRecord, NewConversionRecord } from './conversion-record';

// The seam the Mongo adapter plugs into. Writing and reading have opposite
// contracts on purpose, because §2 gives them opposite jobs: a conversion is
// answered whether or not its record survives, while /history has nothing to
// answer with and says so.
export interface HistoryRepository {
  // Never rejects. A store that cannot take the record drops it, logged.
  record(entry: NewConversionRecord): Promise<void>;
  // Newest first, at most `limit`, and never more than MAX_HISTORY_LIMIT
  // whatever the caller asks for. Rejects when the store cannot be read.
  findRecent(limit: number): Promise<ConversionRecord[]>;
}
