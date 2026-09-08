import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import type { HistoryItem } from '../../../api/types';
import { createFakeRepositories } from '../../../test/fakes/createFakeRepositories';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { HISTORY_LIMIT, HistoryPanel } from '../components/HistoryPanel';

const entry: HistoryItem = {
  id: '1',
  from: 'USD',
  to: 'UAH',
  amount: 100,
  result: 4143.5,
  rate: 41.435,
  strategy: 'direct',
  source: 'stale-cache',
  ratesTimestamp: '2024-03-05T11:00:00.000Z',
  createdAt: '2024-03-05T12:00:00.000Z',
};

function renderWithItems(items: HistoryItem[]) {
  const fake = createFakeRepositories({ history: { items } });
  renderWithProviders(<HistoryPanel />, { repositories: fake.repositories });
  return fake;
}

describe('HistoryPanel', () => {
  it('lists the returned conversions', async () => {
    const fake = renderWithItems([entry]);

    const row = await screen.findByRole('listitem');
    expect(row).toHaveTextContent('100.00 USD');
    expect(row).toHaveTextContent('4,143.50 UAH');
    expect(row).toHaveTextContent('1 USD = 41.435 UAH');
    expect(row).toHaveTextContent('direct');
    expect(row.querySelector('time')).toHaveAttribute('dateTime', '2024-03-05T12:00:00.000Z');
    expect(fake.historyLimits).toEqual([HISTORY_LIMIT]);
  });

  it('carries the source the conversion was answered from', async () => {
    renderWithItems([entry, { ...entry, id: '2', source: 'provider' }]);

    const [stale, fresh] = await screen.findAllByRole('listitem');
    expect(within(stale as HTMLElement).getByText('stale cache')).toBeInTheDocument();
    expect(within(fresh as HTMLElement).getByText('provider')).toBeInTheDocument();
  });

  it('shows a strategy or a source it has no copy for exactly as the API returned it', async () => {
    renderWithItems([
      {
        ...entry,
        strategy: 'triangular' as HistoryItem['strategy'],
        source: 'mirror' as HistoryItem['source'],
      },
    ]);

    expect(await screen.findByText('triangular')).toBeInTheDocument();
    expect(screen.getByText('mirror')).toBeInTheDocument();
  });

  it('says the list is loading before it says the list is empty', () => {
    renderWithProviders(<HistoryPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading recent conversions…');
    expect(screen.queryByText('No conversions yet')).not.toBeInTheDocument();
  });

  it('invites a first conversion when the list is empty', async () => {
    renderWithProviders(<HistoryPanel />);

    expect(await screen.findByText('No conversions yet')).toBeInTheDocument();
    expect(screen.getByText(/The last 10 appear here/i)).toBeInTheDocument();
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
