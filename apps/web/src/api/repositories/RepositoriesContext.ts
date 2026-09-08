import { createContext } from 'react';
import type { Repositories } from './Repositories';

export const RepositoriesContext = createContext<Repositories | null>(null);
