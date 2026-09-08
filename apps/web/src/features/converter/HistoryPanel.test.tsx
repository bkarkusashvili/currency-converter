import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getHistory } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { renderWithProviders } from '../../test/renderWithProviders';
import { HistoryPanel } from './HistoryPanel';

vi.mock('../../api/endpoints', () => ({
  convert: vi.fn(),
  getCurrencies: vi.fn(),
  getHistory: vi.fn(),
  getHealth: vi.fn(),
}));

describe('HistoryPanel', () => {
  it('lists the returned conversions', async () => {
    vi.mocked(getHistory).mockResolvedValue({
      items: [
        {
          id: '1',
          from: 'USD',
          to: 'UAH',
          amount: 100,
          result: 4143.5,
          rate: 41.435,
          strategy: 'direct',
          createdAt: '2026-09-08T12:00:00.000Z',
        },
      ],
    });

    renderWithProviders(<HistoryPanel />);

    const row = await screen.findByRole('listitem');
    expect(row).toHaveTextContent('100.00 USD');
    expect(row).toHaveTextContent('4,143.50 UAH');
    expect(row).toHaveTextContent('1 USD = 41.435000 UAH');
    expect(row).toHaveTextContent('direct');
  });

  it('invites a first conversion when the list is empty', async () => {
    vi.mocked(getHistory).mockResolvedValue({ items: [] });

    renderWithProviders(<HistoryPanel />);

    expect(await screen.findByText(/No conversions yet/i)).toBeInTheDocument();
  });

  it('says the panel is unavailable without blocking the converter', async () => {
    vi.mocked(getHistory).mockRejectedValue(
      new ApiError({
        statusCode: 503,
        code: 'INTERNAL_ERROR',
        message: 'History storage is unavailable.',
      }),
    );

    renderWithProviders(<HistoryPanel />);

    expect(await screen.findByText(/Recent conversions are unavailable/i)).toBeInTheDocument();
    expect(screen.getByText('History storage is unavailable.')).toBeInTheDocument();
  });

  it('requests the configured number of conversions', async () => {
    vi.mocked(getHistory).mockResolvedValue({ items: [] });

    renderWithProviders(<HistoryPanel limit={5} />);

    await screen.findByText(/No conversions yet/i);
    expect(getHistory).toHaveBeenCalledWith(5, expect.anything());
  });
});
