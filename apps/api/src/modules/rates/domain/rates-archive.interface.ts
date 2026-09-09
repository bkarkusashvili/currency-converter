import { RatesSnapshot } from './exchange-rate.types';
import { ArchivedSnapshot } from './rate-history.types';

// The archive seam: one document per UTC day, always that day's latest
// snapshot. Writing and reading have opposite contracts on purpose, because §2
// gives them opposite jobs — a fetch is answered whether or not the day is
// archived, while /rates/history has nothing to answer with and says so.
export interface RatesArchive {
  // Never rejects. A store that cannot take the snapshot drops it, logged once
  // per outage, and answers `false`: the rates are served either way, and
  // whether the day can be read back from /rates/history afterwards is the one
  // part of that the client cannot see for itself (§3's ARCHIVE_NOT_RECORDED
  // warning). Upserts on the day key, so the last fetch of a day is the one
  // the day holds.
  save(snapshot: RatesSnapshot): Promise<boolean>;
  // The newest archived day, or `null` when the archive holds none. This is
  // the fourth tier of the lookup (§4), reached only after the upstream failed
  // and both cache keys missed. Rejects when the store cannot be read.
  findLatest(): Promise<ArchivedSnapshot | null>;
  // Every archived day inside a window of `days` ending today, oldest first,
  // and never more than MAX_RATE_HISTORY_DAYS of them whatever the caller
  // asks for. Rejects when the store cannot be read.
  findWindow(days: number): Promise<ArchivedSnapshot[]>;
}

export const RATES_ARCHIVE = Symbol('RATES_ARCHIVE');
