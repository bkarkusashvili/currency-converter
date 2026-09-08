import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import type { ConvertResponse, RatesSnapshotResponse } from '../../../api/types';
import {
  createFakeRepositories,
  type FakeRepositoriesOptions,
} from '../../../test/fakes/createFakeRepositories';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ConverterPage } from '../components/ConverterPage';

const QUOTED_AT = '2026-09-08T11:00:00.000Z';

const snapshot: RatesSnapshotResponse = {
  source: 'cache',
  fetchedAt: '2026-09-08T12:00:00.000Z',
  rates: [
    { base: 'USD', quote: 'UAH', buy: 44.35, sell: 44.831, date: QUOTED_AT },
    { base: 'GBP', quote: 'UAH', cross: 60.7562, date: QUOTED_AT },
  ],
};

const converted: ConvertResponse = {
  from: 'USD',
  to: 'UAH',
  amount: 100,
  result: 4435,
  rate: 44.35,
  strategy: 'direct',
  source: 'cache',
  ratesTimestamp: snapshot.fetchedAt,
};

function unreachable(): ApiError {
  return ApiError.network('https://api.test/api/v1/convert', new TypeError('Failed to fetch'));
}

function renderPage(options: FakeRepositoriesOptions) {
  const fake = createFakeRepositories(options);
  renderWithProviders(<ConverterPage />, { repositories: fake.repositories });
  return fake;
}

async function convert(): Promise<void> {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Convert' }));
}

describe('converting while the API is unreachable', () => {
  it('answers from the persisted snapshot and says the rate is an estimate', async () => {
    renderPage({ convert: unreachable(), rates: snapshot });

    await convert();

    const card = await screen.findByRole('region', { name: 'Result' });
    expect(card).toHaveTextContent('4,435.00 UAH');
    expect(card).toHaveTextContent('1 USD = 44.350000 UAH');
    expect(within(card).getByText('offline estimate')).toBeInTheDocument();

    const note = within(card).getByText(/API unreachable; estimated from rates fetched/);
    expect(note.querySelector('time')).not.toBeNull();
    expect(screen.queryByText(/Cannot reach the API/)).not.toBeInTheDocument();
  });

  it('leaves the history alone, because the API never recorded the estimate', async () => {
    const fake = renderPage({ convert: unreachable(), rates: snapshot });
    await waitFor(() => {
      expect(fake.historyLimits).toHaveLength(1);
    });

    await convert();
    await screen.findByRole('region', { name: 'Result' });

    expect(fake.historyLimits).toHaveLength(1);
  });

  it('refetches the history when the API did answer', async () => {
    const fake = renderPage({ convert: converted, rates: snapshot });
    await waitFor(() => {
      expect(fake.historyLimits).toHaveLength(1);
    });

    await convert();
    await screen.findByRole('region', { name: 'Result' });

    await waitFor(() => {
      expect(fake.historyLimits).toHaveLength(2);
    });
    expect(screen.getByText('cache')).toBeInTheDocument();
  });

  it('estimates when the API answers a 5xx of its own', async () => {
    renderPage({
      convert: new ApiError({
        statusCode: 503,
        code: 'RATES_UNAVAILABLE',
        message: 'Exchange rates are unavailable',
      }),
      rates: snapshot,
    });

    await convert();

    expect(await screen.findByText('offline estimate')).toBeInTheDocument();
  });

  it('does not estimate around an answer that describes the request', async () => {
    renderPage({
      convert: new ApiError({
        statusCode: 422,
        code: 'UNSUPPORTED_CURRENCY',
        message: "Currency 'XYZ' is not supported",
      }),
      rates: snapshot,
    });

    await convert();

    expect(
      await screen.findByText(/That currency is not in the current rate snapshot/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Result' })).not.toBeInTheDocument();
  });

  it('does not estimate a pair the snapshot cannot price', async () => {
    renderPage({ convert: unreachable(), rates: { ...snapshot, rates: [] } });

    await convert();

    expect(await screen.findByText(/Cannot reach the API/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Result' })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No rates have been cached in this browser yet/),
    ).not.toBeInTheDocument();
  });

  it('says so when nothing has been cached to estimate from', async () => {
    renderPage({
      convert: unreachable(),
      rates: ApiError.network('https://api.test/api/v1/rates', new TypeError('Failed to fetch')),
    });

    await convert();

    const notice = await screen.findByText(/No rates have been cached in this browser yet/);
    expect(notice).toBeInTheDocument();
    expect(screen.getByText(/Cannot reach the API/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Result' })).not.toBeInTheDocument();
  });
});
