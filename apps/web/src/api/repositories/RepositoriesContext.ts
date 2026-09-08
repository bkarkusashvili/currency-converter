import { createContext } from 'react';
import type { Repositories } from './repositories';

export const RepositoriesContext = createContext<Repositories | null>(null);
