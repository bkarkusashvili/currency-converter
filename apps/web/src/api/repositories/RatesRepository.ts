import type { RatesSnapshotResponse } from '../types';

export interface RatesRepository {
  getSnapshot(signal?: AbortSignal): Promise<RatesSnapshotResponse>;
}
