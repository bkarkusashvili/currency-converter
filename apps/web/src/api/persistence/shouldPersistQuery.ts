import { queryKeys } from '../queryKeys';

/** The part of a `Query` this decision reads; `Query` itself satisfies it. */
interface PersistableQuery {
  queryKey: readonly unknown[];
  state: { data: unknown };
}

const PERSISTED_KEYS: readonly string[] = [queryKeys.rates[0], queryKeys.currencies[0]];

/**
 * Only the two queries an offline browser can still answer from: the rate
 * snapshot the estimate is computed with and the currency list the form needs
 * to stay usable. History is a server-owned list that would be wrong the moment
 * it was restored, and a stored health report describes a moment, not a state.
 *
 * The test is `data`, not `status`. query-core moves a query to `error` when a
 * refetch fails while keeping the data it already had, and the persister
 * rewrites the whole blob on every cache event: filtering on `success` would
 * erase the snapshot the instant the API became unreachable, which is the
 * instant it exists for. A query that has never resolved carries no `data` and
 * is still skipped, so nothing empty is written.
 */
export function shouldPersistQuery(query: PersistableQuery): boolean {
  const [root] = query.queryKey;

  return (
    query.state.data !== undefined && typeof root === 'string' && PERSISTED_KEYS.includes(root)
  );
}
