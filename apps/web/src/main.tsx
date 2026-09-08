import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { createHttpRepositories } from './api/repositories/createHttpRepositories';
import { RepositoriesProvider } from './api/repositories/RepositoriesProvider';
import { i18nInstance } from './i18n';
import './index.css';
import { createQueryClient } from './queryClient';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('index.html is missing the #root element');
}

createRoot(container).render(
  <StrictMode>
    <I18nextProvider i18n={i18nInstance}>
      <RepositoriesProvider repositories={createHttpRepositories()}>
        <QueryClientProvider client={createQueryClient()}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </RepositoriesProvider>
    </I18nextProvider>
  </StrictMode>,
);
