import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import { queryKeys } from '../../../api/queryKeys';
import type { ConvertResponse, RatesSnapshotResponse } from '../../../api/types';
import {
  createFakeRepositories,
  type FakeRepositoriesOptions,
} from '../../../test/fakes/createFakeRepositories';
import { createTestQueryClient, renderWithProviders } from '../../../test/renderWithProviders';
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
  const queryClient = createTestQueryClient();
  renderWithProviders(<ConverterPage />, { repositories: fake.repositories, queryClient });
  return { ...fake, queryClient };
}

async function convert(): Promise<void> {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Convert' }));
}

/**
 * What a browser does when it loses the network: `navigator.onLine` flips and
 * the window fires `offline`, which is the event query-core's `onlineManager`
 * listens for. Nothing here touches the client — the queries and the mutation
 * decide for themselves whether a request is worth making.
 */
function goOffline(): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  window.dispatchEvent(new Event('offline'));
}

async function loaded(page: { queryClient: QueryClient }): Promise<void> {
  await waitFor(() => {
    expect(page.queryClient.getQueryData(queryKeys.rates)).toBeDefined();
  });
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
    // The age of the rates is on the card once, in the sentence that warns about it.
    expect(card.querySelectorAll('time')).toHaveLength(1);
    expect(within(card).queryByText(/Rates fetched/)).not.toBeInTheDocument();
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
    const card = await screen.findByRole('region', { name: 'Result' });

    await waitFor(() => {
      expect(fake.historyLimits).toHaveLength(2);
    });
    expect(screen.getByText('cache')).toBeInTheDocument();
    // An answer from the API keeps the line every other card carries.
    expect(within(card).getByText(/Rates fetched/)).toBeInTheDocument();
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

describe('converting from a browser that reports itself offline', () => {
  // `onlineManager` is a module singleton, so the window has to be put back.
  afterEach(() => {
    window.dispatchEvent(new Event('online'));
  });

  it('makes the request and estimates from its rejection instead of pausing', async () => {
    const page = renderPage({ convert: unreachable(), rates: snapshot });
    await loaded(page);

    goOffline();
    await convert();

    const card = await screen.findByRole('region', { name: 'Result' });
    expect(within(card).getByText('offline estimate')).toBeInTheDocument();
    expect(card).toHaveTextContent('4,435.00 UAH');
    // A paused mutation never reaches the repository; this one was rejected by it.
    expect(page.convertCalls).toHaveLength(1);
  });

  it('keeps refreshing the snapshot the estimate is priced from', async () => {
    // The fake is reachable even when the browser says it is not, so a query
    // that ran answers with the newer rate and one that was paused does not.
    const options: FakeRepositoriesOptions = { convert: unreachable(), rates: snapshot };
    const page = renderPage(options);
    await loaded(page);

    goOffline();
    options.rates = {
      ...snapshot,
      rates: [{ base: 'USD', quote: 'UAH', buy: 50, sell: 50, date: QUOTED_AT }],
    };
    void page.queryClient.invalidateQueries({ queryKey: queryKeys.rates });
    await convert();

    expect(await screen.findByRole('region', { name: 'Result' })).toHaveTextContent('5,000.00 UAH');
  });

  it('keeps loading the currency list the form offers', async () => {
    const options: FakeRepositoriesOptions = { convert: unreachable(), rates: snapshot };
    const page = renderPage(options);
    await loaded(page);

    goOffline();
    options.currencies = {
      currencies: [{ code: 'GBP', numericCode: 826, name: 'Pound Sterling' }],
    };
    void page.queryClient.invalidateQueries({ queryKey: queryKeys.currencies });

    // One option in each select: the list the query loaded, not the two defaults.
    expect(await screen.findAllByRole('option', { name: 'GBP — Pound Sterling' })).toHaveLength(2);
  });
});
