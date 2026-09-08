import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { shouldPersistQuery } from './shouldPersistQuery';
import { webStorage, type KeyValueStorage } from './webStorage';

export type PersistOptions = Omit<PersistQueryClientOptions, 'queryClient'>;

const STORAGE_KEY = 'currency-converter:query-cache';

/**
 * A week. Rates this old are useless as rates, but the estimate says how old
 * they are, and having one to reject beats an empty page.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The persisted cache is a copy of a response shape, and the shape belongs to
 * the API contract this version was built against. Tying the buster to the
 * package version means a release that changes the contract discards the
 * copies written by the previous one instead of hydrating them into code that
 * no longer reads them.
 */
export function createPersistOptions(
  storage: KeyValueStorage | null = webStorage(),
): PersistOptions | null {
  if (storage === null) {
    return null;
  }

  return {
    persister: createSyncStoragePersister({ storage, key: STORAGE_KEY }),
    maxAge: MAX_AGE_MS,
    buster: __APP_VERSION__,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
}
