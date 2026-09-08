import { queryKeys } from '../queryKeys';

/** The part of a `Query` this decision reads; `Query` itself satisfies it. */
interface PersistableQuery {
  queryKey: readonly unknown[];
  state: { status: string };
}

const PERSISTED_KEYS: readonly string[] = [queryKeys.rates[0], queryKeys.currencies[0]];

/**
 * Only the two queries an offline browser can still answer from: the rate
 * snapshot the estimate is computed with and the currency list the form needs
 * to stay usable. History is a server-owned list that would be wrong the moment
 * it was restored, and a stored health report describes a moment, not a state.
 */
export function shouldPersistQuery(query: PersistableQuery): boolean {
  const [root] = query.queryKey;

  return (
    query.state.status === 'success' && typeof root === 'string' && PERSISTED_KEYS.includes(root)
  );
}
