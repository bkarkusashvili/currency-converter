import type { RatesSnapshot } from '../domain/exchange-rate.types';
import type { ArchivedSnapshot } from '../domain/rate-history.types';
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
// under test. It keeps the two behaviours the contract rests on: one document
// per UTC day, replaced by the last write of that day, and a window read back
// oldest first.
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

  findWindow(days: number): Promise<ArchivedSnapshot[]> {
    if (this.options.failsWith) {
      return Promise.reject(this.options.failsWith);
    }

    const from = utcWindowStart(days, new Date());

    return Promise.resolve(
      this.ordered().filter((snapshot) => snapshot.date >= from),
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
