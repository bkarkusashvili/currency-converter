import type { HealthResponse } from '../types';

export interface HealthRepository {
  report(signal?: AbortSignal): Promise<HealthResponse>;
}
