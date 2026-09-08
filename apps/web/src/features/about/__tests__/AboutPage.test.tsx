import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import type { HealthResponse } from '../../../api/types';
import {
  createFakeRepositories,
  type FakeRepositoriesOptions,
} from '../../../test/fakes/createFakeRepositories';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { AboutPage } from '../components/AboutPage';

const healthy: HealthResponse = {
  status: 'ok',
  details: {
    redis: { status: 'up' },
    mongodb: { status: 'up' },
    monobank: { status: 'up' },
  },
};

function renderAbout(options: FakeRepositoriesOptions = {}) {
  const fake = createFakeRepositories({ health: healthy, ...options });
  renderWithProviders(<AboutPage />, { repositories: fake.repositories });
  return fake;
}

beforeEach(() => {
  window.__APP_CONFIG__ = { apiUrl: 'https://api.test' };
});

describe('AboutPage', () => {
  it('links to the repository, the API docs and the health endpoint', () => {
    renderAbout();

    expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/bkarkusashvili/currency-converter',
    );
    expect(screen.getByRole('link', { name: /API documentation/i })).toHaveAttribute(
      'href',
      'https://api.test/docs',
    );
    expect(screen.getByRole('link', { name: /Health endpoint/i })).toHaveAttribute(
      'href',
      'https://api.test/health',
    );
  });

  it('reports every indicator the API returns, including ones it has no label for', async () => {
    renderAbout({
      health: {
        status: 'ok',
        details: { ...healthy.details, postgres: { status: 'up' } },
      },
    });

    expect(screen.getByText('Checking the API…')).toBeInTheDocument();

    expect(await screen.findByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('MongoDB')).toBeInTheDocument();
    expect(screen.getByText('Monobank')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('API reports every dependency up')).toBeInTheDocument();
  });

  it('renders an indicator status it does not know as it arrived', async () => {
    renderAbout({
      health: {
        status: 'shutting_down',
        details: { redis: { status: 'up' }, monobank: { status: 'degraded' } },
      },
    });

    expect(await screen.findByText('degraded')).toBeInTheDocument();
    expect(screen.getByText('API reports a degraded dependency')).toBeInTheDocument();
  });

  it('shows a degraded API as degraded, not as a failure', async () => {
    renderAbout({
      health: {
        status: 'error',
        info: { mongodb: { status: 'up' }, monobank: { status: 'up' } },
        error: { redis: { status: 'down' } },
        details: {
          redis: { status: 'down' },
          mongodb: { status: 'up' },
          monobank: { status: 'up' },
        },
      },
    });

    expect(await screen.findByText('API reports a degraded dependency')).toBeInTheDocument();
    expect(screen.getByText('Redis').parentElement).toHaveTextContent('down');
    expect(screen.queryByText(/The health endpoint did not answer/i)).not.toBeInTheDocument();
  });

  it('reports a health endpoint that cannot be reached at all', async () => {
    renderAbout({
      health: ApiError.network('https://api.test/health', new TypeError('Failed to fetch')),
    });

    expect(await screen.findByText(/The health endpoint did not answer/i)).toBeInTheDocument();
  });

  it('renders the written sections', () => {
    renderAbout();

    expect(screen.getByRole('heading', { name: 'Where it stands' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What was built' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Two-layer fallback' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why these decisions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to run it' })).toBeInTheDocument();
  });

  it('explains both fallbacks and how to see the client one', () => {
    renderAbout();

    expect(screen.getByText(/labels the response stale cache/)).toBeInTheDocument();
    expect(screen.getByText(/set the Network tab in devtools to Offline/)).toBeInTheDocument();
  });

  it('describes how to run the app without promising a Compose file', () => {
    renderAbout();

    expect(screen.getByRole('link', { name: /Open the README/i })).toHaveAttribute(
      'href',
      'https://github.com/bkarkusashvili/currency-converter#readme',
    );
    expect(screen.getByText(/npm ci && npm run dev/)).toBeInTheDocument();
    expect(screen.getByText(/docker build -t currency-web:local \./)).toBeInTheDocument();
    expect(screen.queryByText(/docker compose up/i)).not.toBeInTheDocument();
  });
});
