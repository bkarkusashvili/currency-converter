import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import { createFakeRepositories } from '../../../test/fakes/createFakeRepositories';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { HISTORY_LIMIT, HistoryPanel } from '../components/HistoryPanel';

describe('HistoryPanel', () => {
  it('lists the returned conversions', async () => {
    const fake = createFakeRepositories({
      history: {
        items: [
          {
            id: '1',
            from: 'USD',
            to: 'UAH',
            amount: 100,
            result: 4143.5,
            rate: 41.435,
            strategy: 'direct',
            createdAt: '2024-03-05T12:00:00.000Z',
          },
        ],
      },
    });

    renderWithProviders(<HistoryPanel />, { repositories: fake.repositories });

    const row = await screen.findByRole('listitem');
    expect(row).toHaveTextContent('100.00 USD');
    expect(row).toHaveTextContent('4,143.50 UAH');
    expect(row).toHaveTextContent('1 USD = 41.435000 UAH');
    expect(row).toHaveTextContent('direct');
    expect(row.querySelector('time')).toHaveAttribute('dateTime', '2024-03-05T12:00:00.000Z');
    expect(fake.historyLimits).toEqual([HISTORY_LIMIT]);
  });

  it('invites a first conversion when the list is empty', async () => {
    renderWithProviders(<HistoryPanel />);

    expect(await screen.findByText(/No conversions yet/i)).toBeInTheDocument();
  });

  it('says the panel is unavailable without blocking the converter', async () => {
    const fake = createFakeRepositories({
      history: new ApiError({
        statusCode: 503,
        code: 'INTERNAL_ERROR',
        message: 'History storage is unavailable.',
      }),
    });

    renderWithProviders(<HistoryPanel />, { repositories: fake.repositories });

    expect(await screen.findByText(/Recent conversions are unavailable/i)).toBeInTheDocument();
    expect(screen.getByText('History storage is unavailable.')).toBeInTheDocument();
  });
});
