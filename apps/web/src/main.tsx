import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { QueryProvider, ServicesProvider, createHttpServices } from './api';
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
      <ServicesProvider services={createHttpServices()}>
        <QueryProvider client={createQueryClient()}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryProvider>
      </ServicesProvider>
    </I18nextProvider>
  </StrictMode>,
);
