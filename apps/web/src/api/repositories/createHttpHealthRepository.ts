import { ApiError } from '../http/ApiError';
import { apiUrl } from '../http/apiUrl';
import { requestAllowingStatuses } from '../http/requestAllowingStatuses';
import type { HealthIndicator, HealthResponse } from '../types';
import type { HealthRepository } from './HealthRepository';

const HEALTH_PATH = '/health';
const REPORTED_STATUSES = [200, 503] as const;

export function createHttpHealthRepository(): HealthRepository {
  return {
    async report(signal?: AbortSignal): Promise<HealthResponse> {
      const body = await requestAllowingStatuses(HEALTH_PATH, REPORTED_STATUSES, signal);

      if (!isHealthReport(body)) {
        throw ApiError.unreadableBody(apiUrl(HEALTH_PATH), 200);
      }

      return body;
    },
  };
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
