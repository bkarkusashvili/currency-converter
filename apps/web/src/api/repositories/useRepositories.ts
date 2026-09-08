import { useContext } from 'react';
import { RepositoriesContext } from './RepositoriesContext';
import type { Repositories } from './Repositories';

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);

  if (repositories === null) {
    throw new Error('useRepositories must be used inside a RepositoriesProvider');
  }

  return repositories;
}
