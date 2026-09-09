import {
  ConversionRecord,
  NewConversionRecord,
} from './conversion-record.types';

// The seam the Mongo adapter plugs into. Writing and reading have opposite
// contracts on purpose, because §2 gives them opposite jobs: a conversion is
// answered whether or not its record survives, while /history has nothing to
// answer with and says so.
export interface HistoryRepository {
  // Never rejects. A store that cannot take the record drops it, logged, and
  // answers `false`: the conversion is served either way, and whether it can be
  // read back from /history afterwards is the one part of that the client
  // cannot see for itself (§3's HISTORY_NOT_RECORDED warning).
  record(entry: NewConversionRecord): Promise<boolean>;
  // Newest first, at most `limit`, and never more than MAX_HISTORY_LIMIT
  // whatever the caller asks for. Rejects when the store cannot be read.
  findRecent(limit: number): Promise<ConversionRecord[]>;
}

export const HISTORY_REPOSITORY = Symbol('HISTORY_REPOSITORY');
