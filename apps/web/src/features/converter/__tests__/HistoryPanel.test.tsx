import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api';
import type { HistoryItem } from '../../../api';
import { createFakeServices } from '../../../test/fakes/createFakeServices';
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
  const fake = createFakeServices({ history: { items } });
  renderWithProviders(<HistoryPanel />, { services: fake.services });
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

  it('badges only the source that needs explaining and leaves the rest as text', async () => {
    renderWithItems([entry, { ...entry, id: '2', source: 'cache' }]);

    const [stale, cached] = await screen.findAllByRole('listitem');
    // The badge is the chip class; a neutral source gets the strategy's treatment.
    expect(within(stale as HTMLElement).getByText('stale cache')).toHaveClass('badge');
    expect(within(cached as HTMLElement).getByText('cache')).not.toHaveClass('badge');
    expect(within(cached as HTMLElement).getByText('direct')).not.toHaveClass('badge');
  });

  it('says how old the rate was on the rows that need it, and only those', async () => {
    renderWithItems([entry, { ...entry, id: '2', source: 'cache' }]);

    const [stale, cached] = await screen.findAllByRole('listitem');
    const age = within(stale as HTMLElement).getByText(/Rates fetched/);
    expect(age).toHaveTextContent('Rates fetched on');
    // The rate's own timestamp, not the row's: those are the two different
    // moments the entry records.
    expect(age.querySelector('time')).toHaveAttribute('dateTime', '2024-03-05T11:00:00.000Z');
    expect(within(cached as HTMLElement).queryByText(/Rates fetched/)).not.toBeInTheDocument();
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
    const fake = createFakeServices({
      history: new ApiError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Cannot GET /api/v1/history',
      }),
    });

    renderWithProviders(<HistoryPanel />, { services: fake.services });

    expect(await screen.findByText(/Recent conversions are unavailable/i)).toBeInTheDocument();
    // Translated through the envelope, as every other failure is: the server's
    // own sentence is not a sentence for a reader.
    expect(screen.getByText('The API does not have that endpoint.')).toBeInTheDocument();
    expect(screen.queryByText(/Cannot GET/)).not.toBeInTheDocument();
  });

  it('falls back to the server sentence for a code it does not know', async () => {
    const fake = createFakeServices({
      history: new ApiError({
        statusCode: 503,
        code: 'HISTORY_ASLEEP',
        message: 'The history store is having a lie-down.',
      }),
    });

    renderWithProviders(<HistoryPanel />, { services: fake.services });

    expect(await screen.findByText('The history store is having a lie-down.')).toBeInTheDocument();
  });
});
