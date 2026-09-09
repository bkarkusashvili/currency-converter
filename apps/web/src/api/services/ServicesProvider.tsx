import type { ReactNode } from 'react';
import { ServicesContext } from './ServicesContext';
import type { Services } from './services';

interface ServicesProviderProps {
  services: Services;
  children: ReactNode;
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}
