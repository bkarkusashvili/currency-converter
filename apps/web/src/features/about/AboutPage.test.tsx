import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AboutPage } from './AboutPage';

vi.mock('../../api/endpoints', () => ({
  convert: vi.fn(),
  getCurrencies: vi.fn(),
  getHistory: vi.fn(),
  getHealth: vi.fn(),
}));

beforeEach(() => {
  window.__APP_CONFIG__ = { apiUrl: 'https://api.test' };
  vi.mocked(getHealth).mockResolvedValue({
    status: 'ok',
    details: {
      redis: { status: 'up' },
      mongodb: { status: 'up' },
      monobank: { status: 'down' },
    },
  });
});

describe('AboutPage', () => {
  it('links to the repository, the API docs and the health endpoint', () => {
    renderWithProviders(<AboutPage />);

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

  it('shows the state of each health indicator', async () => {
    renderWithProviders(<AboutPage />);

    const redis = await screen.findByText('Redis');
    expect(redis.parentElement).toHaveTextContent('up');
    expect(screen.getByText('Monobank').parentElement).toHaveTextContent('down');
  });

  it('reports a failing health endpoint', async () => {
    vi.mocked(getHealth).mockRejectedValue(
      new ApiError({
        statusCode: 0,
        code: 'NETWORK_ERROR',
        message: 'Cannot reach the API at https://api.test.',
      }),
    );

    renderWithProviders(<AboutPage />);

    expect(await screen.findByText(/The health endpoint did not answer/i)).toBeInTheDocument();
  });

  it('renders the written sections', () => {
    renderWithProviders(<AboutPage />);

    expect(screen.getByRole('heading', { name: 'What was built' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why these decisions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to run it' })).toBeInTheDocument();
  });
});
