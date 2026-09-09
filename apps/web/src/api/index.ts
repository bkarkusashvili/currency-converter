/**
 * The data layer's public surface. A feature imports `../../api`, never a file
 * inside it: the hooks and the service interfaces are the contract, and the
 * fetch client behind them (`http/`), the persistence wiring (`persistence/`)
 * and the HTTP implementations are this folder's own business.
 */
export { useConvert } from './hooks/useConvert';
export { useCurrencies } from './hooks/useCurrencies';
export { useHealth } from './hooks/useHealth';
export { useHistory } from './hooks/useHistory';
export { useRatesSnapshot } from './hooks/useRatesSnapshot';

export { ApiError } from './http/ApiError';
export { extractFieldErrors } from './http/fieldErrors';
export type { FieldError } from './http/fieldErrors';

export { QueryProvider } from './persistence/QueryProvider';
export { queryKeys } from './queryKeys';

export { createHttpServices } from './services/createHttpServices';
export { ServicesProvider } from './services/ServicesProvider';
export type { Services } from './services/services';

// The hand-written mirror of the API's DTOs, validated against
// `docs/openapi.json` by `api/__tests__/openapiContract.test.ts`.
export * from './types';
