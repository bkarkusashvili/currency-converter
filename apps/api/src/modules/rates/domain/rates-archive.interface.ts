import { RatesSnapshot } from './exchange-rate.types';
import {
  ArchivedPairDay,
  ArchivedSnapshot,
  RateHistoryQuery,
} from './rate-history.types';

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
  // Every archived day inside the window ending today, oldest first, with the
  // pair projected out of each day and a flag per code (§3's three outcomes are
  // decided from those three fields alone). Never more than
  // MAX_RATE_HISTORY_DAYS days whatever the caller asks for, and never a day
  // dated after today. Rejects when the store cannot be read.
  //
  // The projection is the store's job rather than the caller's: a day document
  // is the whole published board and the answer is three numbers of it, so
  // reading days whole would move kilobytes per point across the wire to throw
  // almost all of them away.
  findPairWindow(query: RateHistoryQuery): Promise<ArchivedPairDay[]>;
}

export const RATES_ARCHIVE = Symbol('RATES_ARCHIVE');
