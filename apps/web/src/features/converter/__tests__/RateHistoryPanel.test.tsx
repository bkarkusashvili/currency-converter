import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api';
import type { RateHistoryResponse, Services } from '../../../api';
import {
  createFakeServices,
  FAKE_RESPONSES,
  type FakeServicesOptions,
} from '../../../test/fakes/createFakeServices';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ConverterPage } from '../components/ConverterPage';
import { RateHistoryPanel } from '../components/RateHistoryPanel';

const week = FAKE_RESPONSES.rateHistory;

function renderPanel(options: FakeServicesOptions = {}) {
  const fake = createFakeServices({ rateHistory: week, ...options });
  renderWithProviders(<RateHistoryPanel base="USD" quote="UAH" />, { services: fake.services });
  return fake;
}

/** A window the archive never answers, so the panel stays in its loading state. */
function pendingHistory(services: Services): Services {
  return {
    ...services,
    rates: {
      ...services.rates,
      getHistory: () => new Promise<RateHistoryResponse>(() => undefined),
    },
  };
}

function archiveDown(): ApiError {
  return new ApiError({
    statusCode: 503,
    code: 'ARCHIVE_UNAVAILABLE',
    message: 'The rate snapshot archive cannot be read.',
  });
}

describe('RateHistoryPanel', () => {
  it('charts the archived week for the selected pair', async () => {
    renderPanel();

    expect(
      await screen.findByRole('img', { name: 'Buy and sell rate, last 7 days' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Rate history · USD / UAH' })).toBeVisible();
    // The move over the window, then what the two lines are.
    expect(screen.getByText(/Up 0\.3% over 7 days/)).toHaveTextContent(
      'Up 0.3% over 7 days · buy 44.21 → 44.35',
    );
    expect(screen.getByText('One point per day · archived snapshots · kept 90 days')).toBeVisible();
    expect(screen.getByText('spread')).toBeVisible();
  });

  it('describes the picture with the same summary a reader gets', async () => {
    renderPanel();
    const chart = await screen.findByRole('img', { name: 'Buy and sell rate, last 7 days' });

    expect(chart).toHaveAccessibleDescription('Up 0.3% over 7 days · buy 44.21 → 44.35');
  });

  it('lists every archived day newest first, with the day it moved by', async () => {
    renderPanel();
    const rows = await screen.findAllByRole('row');
    // The head row, then the seven days.
    expect(rows).toHaveLength(8);

    const latest = rows[1];
    expect(within(latest!).getByRole('rowheader')).toHaveTextContent('9 Sep');
    expect(within(latest!).getByText('44.35')).toBeVisible();
    expect(within(latest!).getByText('44.83')).toBeVisible();
    // The arrow is decorative; the direction is spelled out beside it.
    expect(within(latest!).getByText('▲ 0.05')).toBeVisible();
    expect(within(latest!).getByText('up 0.05')).toBeVisible();
    // The oldest day has no day before it to have moved from.
    expect(within(rows[7]!).getByText('no change')).toBeVisible();
  });

  it('offers the rest of a window it does not show whole', async () => {
    const month: RateHistoryResponse = {
      base: 'USD',
      quote: 'UAH',
      days: 30,
      points: Array.from({ length: 30 }, (_, index) => ({
        date: new Date(Date.UTC(2026, 7, 11 + index)).toISOString().slice(0, 10),
        cross: 0.85 + index / 10_000,
      })),
    };
    const user = userEvent.setup();
    renderPanel({ rateHistory: month });

    expect(await screen.findByText('Showing 7 of 30 days')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show all 30' }));

    expect(await screen.findAllByRole('row')).toHaveLength(31);
    expect(screen.queryByText('Showing 7 of 30 days')).toBeNull();
  });

  it('charts a pair with no spread as one line and no legend', async () => {
    renderPanel({
      rateHistory: {
        base: 'EUR',
        quote: 'GBP',
        days: 30,
        points: [
          { date: '2026-09-07', cross: 0.851012 },
          { date: '2026-09-08', cross: 0.85143 },
          { date: '2026-09-09', cross: 0.850512 },
        ],
      },
    });

    expect(await screen.findByRole('img', { name: 'Cross rate, last 7 days' })).toBeVisible();
    expect(screen.getByText(/Down 0\.1% over 7 days/)).toHaveTextContent(
      'Down 0.1% over 7 days · cross via UAH, no spread',
    );
    expect(screen.queryByText('spread')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Cross' })).toBeVisible();
  });

  it('walks the days with the arrow keys and says what is on each', async () => {
    const user = userEvent.setup();
    renderPanel();
    const oldest = await screen.findByRole('button', { name: 'Thu 3 Sep' });

    await user.click(oldest);
    expect(oldest).toHaveFocus();
    expect(screen.getByText('buy 44.21 · sell 44.70')).toBeVisible();
    // The tooltip is the focused day's description, not a second reading of it.
    expect(oldest).toHaveAccessibleDescription('buy 44.21 · sell 44.70');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Fri 4 Sep' })).toHaveFocus();
    expect(screen.getByText('buy 44.28 · sell 44.76')).toBeVisible();

    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Wed 9 Sep' })).toHaveFocus();
    expect(screen.getByText('buy 44.35 · sell 44.83')).toBeVisible();

    await user.keyboard('{Home}');
    expect(oldest).toHaveFocus();

    // The far end of the series is as far as an arrow key goes.
    await user.keyboard('{ArrowLeft}');
    expect(oldest).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('buy 44.21 · sell 44.70')).toBeNull();
  });

  it('shades the table row for the day the chart cursor is on', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.hover(await screen.findByRole('button', { name: 'Mon 7 Sep' }));

    const row = screen.getByRole('row', { name: /7 Sep/ });
    expect(row.className).toContain('bg-sunken');
  });

  it('asks for the window the reader picked', async () => {
    const user = userEvent.setup();
    const fake = renderPanel();

    await screen.findByRole('img', { name: 'Buy and sell rate, last 7 days' });
    expect(fake.rateHistoryQueries).toEqual([{ base: 'USD', quote: 'UAH', days: 7 }]);

    await user.click(screen.getByRole('radio', { name: '30D' }));

    await waitFor(() => {
      expect(fake.rateHistoryQueries).toContainEqual({ base: 'USD', quote: 'UAH', days: 30 });
    });

    await user.click(screen.getByRole('radio', { name: '90D' }));

    await waitFor(() => {
      expect(fake.rateHistoryQueries).toContainEqual({ base: 'USD', quote: 'UAH', days: 90 });
    });
  });

  it('says it is loading, and leaves the range switchable while it does', () => {
    const { services } = createFakeServices();
    renderWithProviders(<RateHistoryPanel base="USD" quote="UAH" />, {
      services: pendingHistory(services),
    });

    expect(screen.getByRole('status')).toBeVisible();
    expect(screen.getByText('Loading rate history…')).toBeVisible();
    expect(screen.getByRole('radio', { name: '30D' })).toBeEnabled();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says a pair with no archived day has none yet, rather than that something failed', async () => {
    renderPanel({ rateHistory: { base: 'ISK', quote: 'CHF', days: 7, points: [] } });

    expect(await screen.findByText('No history for this pair yet')).toBeVisible();
    expect(screen.getByText('No days recorded yet')).toBeVisible();
    expect(
      screen.getByText(
        'History starts collecting from the first fetch. Today’s rate will be the first point tomorrow.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Rate history is unavailable. Converting still works.')).toBeNull();
  });

  it('reads a 422 as a pair with nothing archived, not as a failure', async () => {
    renderPanel({
      rateHistory: new ApiError({
        statusCode: 422,
        code: 'RATE_NOT_AVAILABLE',
        message: 'No archived rate for that pair.',
      }),
    });

    expect(await screen.findByText('No history for this pair yet')).toBeVisible();
    expect(screen.queryByText('Rate history is unavailable. Converting still works.')).toBeNull();
  });

  it('reports an archive it cannot read, and offers to ask again', async () => {
    const user = userEvent.setup();
    const fake = renderPanel({ rateHistory: archiveDown() });

    expect(
      await screen.findByText('Rate history is unavailable. Converting still works.'),
    ).toBeVisible();
    // The envelope read the way every other failure is read.
    expect(
      screen.getByText('Rate history cannot be read right now: the rate archive is unreachable.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(fake.rateHistoryQueries.length).toBeGreaterThan(1);
    });
  });

  it('says when the window it is failing on was last on screen', async () => {
    let answer: RateHistoryResponse | ApiError = week;
    const { services } = createFakeServices();
    const user = userEvent.setup();

    renderWithProviders(<RateHistoryPanel base="USD" quote="UAH" />, {
      services: {
        ...services,
        rates: {
          ...services.rates,
          getHistory: () =>
            answer instanceof ApiError ? Promise.reject(answer) : Promise.resolve(answer),
        },
      },
    });

    await screen.findByRole('img', { name: 'Buy and sell rate, last 7 days' });
    answer = archiveDown();

    // Away to a window the archive cannot answer, then back to the one it
    // already answered once: what comes back is a refetch that fails.
    await user.click(screen.getByRole('radio', { name: '30D' }));
    await screen.findByText('Rate history is unavailable. Converting still works.');
    await user.click(screen.getByRole('radio', { name: '7D' }));
    await screen.findByText('Rate history is unavailable. Converting still works.');

    // The chart it had is not redrawn under a note saying it could not be read.
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/^Last shown: 7 days, /)).toBeVisible();
  });

  it('opens and closes where the panel is collapsed by default', async () => {
    const user = userEvent.setup();
    renderPanel();

    const toggle = await screen.findByRole('button', { name: 'Show the rate history' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Hide the rate history' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('the converter page while the panel is not answering', () => {
  it('leaves Convert enabled while the rate history loads', () => {
    const { services } = createFakeServices({ currencies: FAKE_RESPONSES.currencies });
    renderWithProviders(<ConverterPage />, { services: pendingHistory(services) });

    expect(screen.getByRole('button', { name: 'Convert' })).toBeEnabled();
    expect(screen.getByText('Loading rate history…')).toBeVisible();
  });

  it('leaves Convert enabled when the rate history fails', async () => {
    const fake = createFakeServices({
      currencies: FAKE_RESPONSES.currencies,
      convert: FAKE_RESPONSES.convert,
      rateHistory: archiveDown(),
    });
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />, { services: fake.services });

    await screen.findByText('Rate history is unavailable. Converting still works.');
    expect(screen.getByRole('button', { name: 'Convert' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(fake.convertCalls).toEqual([{ from: 'USD', to: 'UAH', amount: 100 }]);
  });

  it('follows the pair the form is on, including through a swap', async () => {
    const fake = createFakeServices({ currencies: FAKE_RESPONSES.currencies });
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />, { services: fake.services });

    await waitFor(() => {
      expect(fake.rateHistoryQueries).toContainEqual({ base: 'USD', quote: 'UAH', days: 7 });
    });

    await user.click(screen.getByRole('button', { name: 'Swap the two currencies' }));

    await waitFor(() => {
      expect(fake.rateHistoryQueries).toContainEqual({ base: 'UAH', quote: 'USD', days: 7 });
    });
  });
});
