import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api';
import type { ConvertResponse, HistoryItem } from '../../../api';
import { createFakeServices, FAKE_RESPONSES } from '../../../test/fakes/createFakeServices';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ConverterPage } from '../components/ConverterPage';
import { HistoryPanel } from '../components/HistoryPanel';

/**
 * The archive is the API's last tier, and the one whose rates are dated to a
 * **day**: everything that says when they are from says a date and drops the
 * clock time, because the archive keeps one snapshot per day (§3.12, board 3f).
 */
const archived: ConvertResponse = {
  from: 'USD',
  to: 'UAH',
  amount: 1000,
  result: 44330,
  rate: 44.33,
  strategy: 'direct',
  source: 'archive',
  ratesTimestamp: '2026-09-07T20:45:00.000Z',
};

const archivedRow: HistoryItem = {
  id: '1',
  ...archived,
  createdAt: '2026-09-09T12:00:00.000Z',
};

async function convert(): Promise<HTMLElement> {
  const user = userEvent.setup();
  const fake = createFakeServices({ currencies: FAKE_RESPONSES.currencies, convert: archived });
  renderWithProviders(<ConverterPage />, { services: fake.services });

  await user.click(screen.getByRole('button', { name: 'Convert' }));
  const term = await screen.findByText('Strategy');

  return term.closest('form') as HTMLElement;
}

describe('an answer served from the archive', () => {
  it('wears the warn source badge the other out-of-date sources wear', async () => {
    const card = await convert();

    expect(within(card).getByText('archive')).toHaveClass('badge-warn');
  });

  it('dates its rates to the archived day, with no time of day', async () => {
    const card = await convert();
    const stamps = within(card).getAllByText('Rates from 7 Sep 2026');

    // The eyebrow across the provenance footer, and the lead of the sentence
    // under Source.
    expect(stamps).toHaveLength(2);
    expect(stamps[0]?.tagName).toBe('TIME');
    expect(stamps[0]).toHaveAttribute('dateTime', '2026-09-07T20:45:00.000Z');
    expect(within(card).queryByText(/Rates fetched/)).toBeNull();
  });

  it('says which tier answered, after the date it answered from', async () => {
    const card = await convert();
    const source = within(card).getByText('Source').parentElement;

    expect(source).toHaveTextContent(
      'Rates from 7 Sep 2026 — Monobank and the cache were unreachable, so the archived daily snapshot was used.',
    );
  });

  it('repeats the date on the history row it produced', async () => {
    const fake = createFakeServices({ history: { items: [archivedRow] } });
    renderWithProviders(<HistoryPanel />, { services: fake.services });

    const row = await screen.findByRole('listitem');
    expect(within(row).getByText('archive')).toHaveClass('badge-warn');
    expect(within(row).getByText('Rates from 7 Sep 2026')).toBeVisible();
    expect(within(row).queryByText(/Rates fetched/)).toBeNull();
  });

  it('leaves a row from a source with a clock time reading the clock time', async () => {
    const fake = createFakeServices({
      history: { items: [{ ...archivedRow, source: 'stale-cache' }] },
    });
    renderWithProviders(<HistoryPanel />, { services: fake.services });

    const row = await screen.findByRole('listitem');
    expect(within(row).getByText(/Rates fetched/)).toBeVisible();
    expect(within(row).queryByText(/Rates from/)).toBeNull();
  });

  it('has a sentence for the day a fetched snapshot could not be archived', async () => {
    const user = userEvent.setup();
    const fake = createFakeServices({
      currencies: FAKE_RESPONSES.currencies,
      convert: {
        ...archived,
        source: 'provider',
        warnings: [{ code: 'ARCHIVE_NOT_RECORDED', message: 'The API says it in its own words.' }],
      },
    });
    renderWithProviders(<ConverterPage />, { services: fake.services });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(
      await screen.findByText(
        'The rates behind this answer were fetched but could not be archived, so that day will be missing from the rate history and cannot back a later fallback.',
      ),
    ).toBeVisible();
  });

  it('has a sentence for an archive that cannot be read at all', async () => {
    const fake = createFakeServices({
      currencies: FAKE_RESPONSES.currencies,
      rateHistory: new ApiError({
        statusCode: 503,
        code: 'ARCHIVE_UNAVAILABLE',
        message: 'The rate snapshot archive cannot be read.',
      }),
    });
    renderWithProviders(<ConverterPage />, { services: fake.services });

    // The client's own sentence for the code, not the server's text.
    expect(
      await screen.findByText(
        'Rate history cannot be read right now: the rate archive is unreachable.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('The rate snapshot archive cannot be read.')).toBeNull();
  });
});
