import { describe, expect, it } from 'vitest';
import { queryKeys } from '../../queryKeys';
import { shouldPersistQuery } from '../shouldPersistQuery';

/** The shape query-core hands `shouldDehydrateQuery`, narrowed to what the filter reads. */
function query(queryKey: readonly unknown[], state: { data?: unknown; status?: string } = {}) {
  return { queryKey, state: { data: { rates: [] }, status: 'success', ...state } };
}

describe('shouldPersistQuery', () => {
  it('keeps the two queries an offline browser can answer from', () => {
    expect(shouldPersistQuery(query(queryKeys.rates))).toBe(true);
    expect(shouldPersistQuery(query(queryKeys.currencies))).toBe(true);
  });

  it('drops the queries that would be wrong the moment they were restored', () => {
    expect(shouldPersistQuery(query(queryKeys.history.all))).toBe(false);
    expect(shouldPersistQuery(query(queryKeys.history.list(10)))).toBe(false);
    expect(shouldPersistQuery(query(queryKeys.health))).toBe(false);
    // A day-old series restored from storage would be a day older still.
    expect(shouldPersistQuery(query(queryKeys.rateHistory.all))).toBe(false);
    expect(shouldPersistQuery(query(queryKeys.rateHistory.pair('USD', 'UAH', 7)))).toBe(false);
  });

  it('keeps the data a failed refetch left behind, which is when it is needed', () => {
    expect(shouldPersistQuery(query(queryKeys.rates, { status: 'error' }))).toBe(true);
    expect(shouldPersistQuery(query(queryKeys.currencies, { status: 'error' }))).toBe(true);
  });

  it('drops a query with nothing to persist', () => {
    expect(shouldPersistQuery(query(queryKeys.rates, { data: undefined, status: 'pending' }))).toBe(
      false,
    );
    expect(shouldPersistQuery(query(queryKeys.rates, { data: undefined, status: 'error' }))).toBe(
      false,
    );
  });

  it('drops a key that is not one of ours', () => {
    expect(shouldPersistQuery(query([42]))).toBe(false);
  });
});
