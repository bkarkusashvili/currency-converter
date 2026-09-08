import { ApiError } from '../../api/http/ApiError';
import type { Repositories } from '../../api/repositories/Repositories';
import type {
  ConvertRequest,
  ConvertResponse,
  CurrenciesResponse,
  HealthResponse,
  HistoryResponse,
} from '../../api/types';

/** Either the value the repository answers with, or the error it rejects with. */
export type Answer<T> = T | ApiError;

export interface FakeRepositoriesOptions {
  convert?: Answer<ConvertResponse>;
  currencies?: Answer<CurrenciesResponse>;
  history?: Answer<HistoryResponse>;
  health?: Answer<HealthResponse>;
}

export interface FakeRepositories {
  repositories: Repositories;
  convertCalls: ConvertRequest[];
  historyLimits: number[];
}

const EMPTY_CURRENCIES: CurrenciesResponse = { currencies: [] };
const EMPTY_HISTORY: HistoryResponse = { items: [] };
const HEALTHY: HealthResponse = { status: 'ok', details: {} };

/**
 * In-memory stand-in for the repository layer. Tests inject it through
 * RepositoriesProvider instead of mocking the HTTP modules.
 */
export function createFakeRepositories(options: FakeRepositoriesOptions = {}): FakeRepositories {
  const convertCalls: ConvertRequest[] = [];
  const historyLimits: number[] = [];

  const repositories: Repositories = {
    conversion: {
      convert(request) {
        convertCalls.push(request);
        return answer(options.convert ?? neverConverted());
      },
    },
    currencies: {
      list: () => answer(options.currencies ?? EMPTY_CURRENCIES),
    },
    history: {
      recent(limit) {
        historyLimits.push(limit);
        return answer(options.history ?? EMPTY_HISTORY);
      },
    },
    health: {
      report: () => answer(options.health ?? HEALTHY),
    },
  };

  return { repositories, convertCalls, historyLimits };
}

function answer<T>(value: Answer<T>): Promise<T> {
  return value instanceof ApiError ? Promise.reject(value) : Promise.resolve(value);
}

function neverConverted(): ApiError {
  return new ApiError({
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'The test did not configure a conversion result.',
  });
}
