import { useContext } from 'react';
import { ServicesContext } from './ServicesContext';
import type { Services } from './services';

export function useServices(): Services {
  const services = useContext(ServicesContext);

  if (services === null) {
    throw new Error('useServices must be used inside a ServicesProvider');
  }

  return services;
}
