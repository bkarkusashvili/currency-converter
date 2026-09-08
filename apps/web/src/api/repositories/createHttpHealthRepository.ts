import { request } from '../http/request';
import type { HealthIndicator, HealthResponse } from '../types';
import type { HealthRepository } from './HealthRepository';

const HEALTH_PATH = '/health';

/** Both statuses carry the terminus report; only the report itself says what is down. */
const REPORTED_STATUSES = [200, 503] as const;

export function createHttpHealthRepository(): HealthRepository {
  return {
    report(signal?: AbortSignal): Promise<HealthResponse> {
      return request<HealthResponse>(HEALTH_PATH, {
        signal,
        acceptStatuses: REPORTED_STATUSES,
        parse: toHealthReport,
      });
    },
  };
}

function toHealthReport(body: unknown): HealthResponse | null {
  return isHealthReport(body) ? body : null;
}

function isHealthReport(body: unknown): body is HealthResponse {
  return (
    isRecord(body) &&
    typeof body.status === 'string' &&
    isRecord(body.details) &&
    Object.values(body.details).every(isIndicator)
  );
}

function isIndicator(value: unknown): value is HealthIndicator {
  return isRecord(value) && typeof value.status === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
