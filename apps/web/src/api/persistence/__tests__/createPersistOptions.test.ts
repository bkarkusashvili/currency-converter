import { dehydrate, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../queryKeys';
import { createPersistOptions } from '../createPersistOptions';
import type { KeyValueStorage } from '../webStorage';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function memoryStorage(): KeyValueStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

function seededClient(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(queryKeys.rates, { source: 'cache', fetchedAt: 'now', rates: [] });
  client.setQueryData(queryKeys.currencies, { currencies: [] });
  client.setQueryData(queryKeys.history.list(10), { items: [] });
  client.setQueryData(queryKeys.health, { status: 'ok', details: {} });
  return client;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createPersistOptions', () => {
  it('does not persist anything without usable storage', () => {
    expect(createPersistOptions(null)).toBeNull();
  });

  it('writes only the rates snapshot and the currency list', () => {
    const options = createPersistOptions(memoryStorage());

    const dehydrated = dehydrate(seededClient(), options?.dehydrateOptions);

    expect(dehydrated.queries.map((query) => query.queryKey)).toEqual([
      queryKeys.rates,
      queryKeys.currencies,
    ]);
  });

  it('keeps a cache for a week and busts it on a new app version', () => {
    const options = createPersistOptions(memoryStorage());

    expect(options?.maxAge).toBe(SEVEN_DAYS_MS);
    expect(options?.buster).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('round-trips the cache through the storage it was given', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const options = createPersistOptions(storage);
    const persisted = {
      timestamp: Date.now(),
      buster: '0.0.0',
      clientState: dehydrate(new QueryClient()),
    };

    await options?.persister.persistClient(persisted);
    // The persister throttles writes, so nothing reaches storage until the timer fires.
    vi.advanceTimersByTime(1_000);

    expect(await options?.persister.restoreClient()).toMatchObject({ buster: '0.0.0' });

    await options?.persister.removeClient();
    expect(await options?.persister.restoreClient()).toBeUndefined();
  });
});
