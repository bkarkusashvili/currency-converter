import type { CurrencyCode } from '../../../common/currency';
import type {
  ExchangeRate,
  RatesSnapshot,
} from '../domain/exchange-rate.types';
import { MAX_RATE_HISTORY_DAYS } from '../domain/rate-history-window.constants';
import type {
  ArchivedPairDay,
  ArchivedSnapshot,
  RateHistoryQuery,
} from '../domain/rate-history.types';
import type { RatesArchive } from '../domain/rates-archive.interface';
import { toUtcDay, utcWindowStart } from '../domain/utc-day.util';

interface InMemoryArchiveOptions {
  // What a broken store does to all three paths, so a suite can watch the rates
  // survive an archive that cannot take them and /rates/history report the
  // outage.
  failsWith?: Error;
  // Days the archive already holds, in the shape the port answers with. A suite
  // that wants a fallback to exist seeds it here rather than by replaying
  // fetches through `save`, which can only ever write today.
  seed?: ArchivedSnapshot[];
}

// Stands in for the Mongo adapter wherever the store itself is not what is
// under test. It keeps the three behaviours the contract rests on: one document
// per UTC day, replaced by the last write of that day; a window read back
// oldest first; and a window read projected to one pair, which is what the
// aggregation answers with.
export class InMemoryRatesArchive implements RatesArchive {
  private readonly days = new Map<string, ArchivedSnapshot>();

  constructor(private readonly options: InMemoryArchiveOptions = {}) {
    for (const snapshot of options.seed ?? []) {
      this.days.set(snapshot.date, snapshot);
    }
  }

  save(snapshot: RatesSnapshot): Promise<boolean> {
    if (this.options.failsWith) {
      return Promise.resolve(false);
    }

    const date = toUtcDay(new Date(snapshot.fetchedAt));
    this.days.set(date, {
      date,
      fetchedAt: snapshot.fetchedAt,
      rates: snapshot.rates,
    });

    return Promise.resolve(true);
  }

  findLatest(): Promise<ArchivedSnapshot | null> {
    if (this.options.failsWith) {
      return Promise.reject(this.options.failsWith);
    }

    const [newest] = this.ordered().reverse();

    return Promise.resolve(newest ?? null);
  }

  findPairWindow({
    base,
    quote,
    days,
  }: RateHistoryQuery): Promise<ArchivedPairDay[]> {
    if (this.options.failsWith) {
      return Promise.reject(this.options.failsWith);
    }

    const now = new Date();
    const from = utcWindowStart(Math.min(days, MAX_RATE_HISTORY_DAYS), now);
    const today = toUtcDay(now);

    return Promise.resolve(
      this.ordered()
        .filter((snapshot) => snapshot.date >= from && snapshot.date <= today)
        .map((snapshot) => projectPair(snapshot, base, quote)),
    );
  }

  // A UTC day key sorts lexicographically in date order, which is the same
  // property the Mongo adapter reads its window off the `_id` index with.
  private ordered(): ArchivedSnapshot[] {
    return [...this.days.values()].sort((first, second) =>
      first.date.localeCompare(second.date),
    );
  }
}

// What the aggregation's `$filter`, `$map` and two `$anyElementTrue` stages do,
// in the process: the pair in exactly the orientation it was published in,
// narrowed to the three numbers, and one flag per code.
function projectPair(
  snapshot: ArchivedSnapshot,
  base: CurrencyCode,
  quote: CurrencyCode,
): ArchivedPairDay {
  const published = snapshot.rates.find(
    (rate) => rate.base === base && rate.quote === quote,
  );

  return {
    date: snapshot.date,
    ...(published === undefined ? {} : { rate: numbersOf(published) }),
    quotesBase: quotes(snapshot, base),
    quotesQuote: quotes(snapshot, quote),
  };
}

// A missing field resolves to nothing in an aggregation rather than to null, so
// the projected rate carries only the numbers the day published.
function numbersOf(rate: ExchangeRate): ArchivedPairDay['rate'] {
  return {
    ...(rate.buy === undefined ? {} : { buy: rate.buy }),
    ...(rate.sell === undefined ? {} : { sell: rate.sell }),
    ...(rate.cross === undefined ? {} : { cross: rate.cross }),
  };
}

function quotes(snapshot: ArchivedSnapshot, code: CurrencyCode): boolean {
  return snapshot.rates.some(
    (rate) => rate.base === code || rate.quote === code,
  );
}
