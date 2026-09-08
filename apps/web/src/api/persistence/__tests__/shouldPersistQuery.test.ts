import { describe, expect, it } from 'vitest';
import { queryKeys } from '../../queryKeys';
import { shouldPersistQuery } from '../shouldPersistQuery';

function query(queryKey: readonly unknown[], status = 'success') {
  return { queryKey, state: { status } };
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
  });

  it('drops a query that has not succeeded', () => {
    expect(shouldPersistQuery(query(queryKeys.rates, 'pending'))).toBe(false);
    expect(shouldPersistQuery(query(queryKeys.rates, 'error'))).toBe(false);
  });

  it('drops a key that is not one of ours', () => {
    expect(shouldPersistQuery(query([42]))).toBe(false);
  });
});
