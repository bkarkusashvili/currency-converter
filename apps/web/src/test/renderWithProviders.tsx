import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { RepositoriesProvider } from '../api/repositories/RepositoriesProvider';
import type { Repositories } from '../api/repositories/Repositories';
import { i18nInstance } from '../i18n';
import { createFakeRepositories } from './fakes/createFakeRepositories';

interface RenderOptions {
  repositories?: Repositories;
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  const repositories = options.repositories ?? createFakeRepositories().repositories;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <I18nextProvider i18n={i18nInstance}>
      <RepositoriesProvider repositories={repositories}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>
      </RepositoriesProvider>
    </I18nextProvider>,
  );
}
