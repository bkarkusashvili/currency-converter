import { Types } from 'mongoose';
import type {
  ConversionRecord,
  NewConversionRecord,
} from '../domain/conversion-record.types';
import type { HistoryRepository } from '../domain/history-repository.interface';

interface InMemoryHistoryOptions {
  // What a broken store does to both paths, so a suite can watch a conversion
  // survive a history that cannot take it and /history report the outage.
  failsWith?: Error;
}

// Stands in for the Mongo adapter wherever the store itself is not what is
// under test: it assigns the two fields the store owns and answers newest
// first, which is the order the index the repository sorts on produces.
export class InMemoryHistoryRepository implements HistoryRepository {
  private readonly records: ConversionRecord[] = [];

  constructor(private readonly options: InMemoryHistoryOptions = {}) {}

  record(entry: NewConversionRecord): Promise<boolean> {
    if (this.options.failsWith) {
      return Promise.reject(this.options.failsWith);
    }

    this.records.push({
      ...entry,
      id: new Types.ObjectId().toString(),
      createdAt: new Date().toISOString(),
    });

    return Promise.resolve(true);
  }

  findRecent(limit: number): Promise<ConversionRecord[]> {
    if (this.options.failsWith) {
      return Promise.reject(this.options.failsWith);
    }

    return Promise.resolve([...this.records].reverse().slice(0, limit));
  }
}
