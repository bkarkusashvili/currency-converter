import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useMemo, type ReactNode } from 'react';
import { createPersistOptions } from './createPersistOptions';

interface QueryProviderProps {
  client: QueryClient;
  children: ReactNode;
}

/**
 * Persistence is an enhancement, not a dependency: a browser without usable
 * storage gets the plain in-memory client and loses only the offline estimate.
 * The options are computed once so the branch — and with it the subtree — never
 * changes for the life of the app.
 */
export function QueryProvider({ client, children }: QueryProviderProps) {
  const persistOptions = useMemo(() => createPersistOptions(), []);

  if (persistOptions === null) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider client={client} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
