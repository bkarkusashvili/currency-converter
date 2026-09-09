import { createContext } from 'react';
import type { Services } from './services';

export const ServicesContext = createContext<Services | null>(null);
