import type { ReactNode } from 'react';
import { RepositoriesContext } from './RepositoriesContext';
import type { Repositories } from './Repositories';

interface RepositoriesProviderProps {
  repositories: Repositories;
  children: ReactNode;
}

export function RepositoriesProvider({ repositories, children }: RepositoriesProviderProps) {
  return (
    <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>
  );
}
