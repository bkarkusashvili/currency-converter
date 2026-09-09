import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { ServicesProvider } from '../api';
import type { Services } from '../api';
import { i18nInstance } from '../i18n';
import { ThemeProvider } from '../theme';
import { createFakeServices } from './fakes/createFakeServices';

interface RenderOptions {
  services?: Services;
  /**
   * A client seeded with query data, which is what the persisted cache
   * hydrates into: a test that needs data a failing request cannot produce
   * puts it here rather than reaching for localStorage.
   */
  queryClient?: QueryClient;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  const services = options.services ?? createFakeServices().services;
  const queryClient = options.queryClient ?? createTestQueryClient();

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <ThemeProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>{ui}</MemoryRouter>
          </QueryClientProvider>
        </ServicesProvider>
      </ThemeProvider>
    </I18nextProvider>,
  );
}
