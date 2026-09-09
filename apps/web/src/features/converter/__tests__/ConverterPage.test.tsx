import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError, queryKeys } from '../../../api';
import type {
  ConvertResponse,
  CurrenciesResponse,
  RatesSnapshotResponse,
  ResponseWarningCode,
} from '../../../api';
import {
  createFakeServices,
  FAKE_RESPONSES,
  type FakeServicesOptions,
} from '../../../test/fakes/createFakeServices';
import { createTestQueryClient, renderWithProviders } from '../../../test/renderWithProviders';
import { ConverterPage } from '../components/ConverterPage';

/**
 * The bodies this page is rendered from are the ones `openapiContract.test.ts`
 * validates against `docs/openapi.json`, rather than a second table beside
 * them: a field the API renames fails the contract check *and* the case that
 * reads it, instead of leaving the two to drift apart.
 */
const currencies = FAKE_RESPONSES.currencies;

// `warnings` is removed rather than set to `undefined`, because §3 makes it
// absent and not empty when nothing degraded — which is what most of these
// cases are about. The two that are about a warning add their own back.
const conversion: ConvertResponse = { ...FAKE_RESPONSES.convert };
delete conversion.warnings;

/**
 * The two-pane card once it holds an answer. The provenance terms render only
 * with one, so waiting for them is waiting for the conversion to land — and
 * the card is the `<form>` around them, input pane and all.
 */
async function findAnsweredCard(): Promise<HTMLElement> {
  const term = await screen.findByText('Strategy');
  return term.closest('form')!;
}

function renderPage(options: FakeServicesOptions = {}) {
  const fake = createFakeServices({ currencies, convert: conversion, ...options });
  renderWithProviders(<ConverterPage />, { services: fake.services });
  return fake;
}

describe('ConverterPage', () => {
  it('blocks submission when the amount is not a positive number', async () => {
    const user = userEvent.setup();
    const fake = renderPage();

    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '0');
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Amount must be greater than zero.');
    expect(fake.convertCalls).toEqual([]);
  });

  it('names the reason the amount cannot be converted', async () => {
    const user = userEvent.setup();
    const fake = renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an amount to convert.');

    // Letters never reach the value, so what is left is an empty field.
    await user.type(amount, 'abc');
    expect(amount).toHaveValue('');

    await user.type(amount, '1000000000001');
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Amount must be 1,000,000,000,000 or less.',
    );

    expect(fake.convertCalls).toEqual([]);
  });

  it('puts the caret on the amount when it is the amount that is wrong', async () => {
    const user = userEvent.setup();
    renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(amount).toHaveFocus();
  });

  it('submits a normalised payload, thousands separator and all', async () => {
    const user = userEvent.setup();
    const fake = renderPage();
    await screen.findAllByRole('option', { name: 'EUR — Euro' });

    await user.selectOptions(screen.getByLabelText('From'), 'EUR');
    await user.selectOptions(screen.getByLabelText('To'), 'PLN');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '1,250.50');
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(fake.convertCalls).toEqual([{ from: 'EUR', to: 'PLN', amount: 1250.5 }]);
    });
  });

  it('swaps the two currencies', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Swap the two currencies' }));

    expect(screen.getByLabelText('From')).toHaveValue('UAH');
    expect(screen.getByLabelText('To')).toHaveValue('USD');
  });

  it('announces the result and explains where the rate came from', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const card = await findAnsweredCard();
    expect(card).toHaveTextContent('425.71 PLN');
    expect(card).toHaveTextContent('1 EUR = 4.257112 PLN');
    expect(within(card).getByText('cross')).toBeInTheDocument();
    expect(within(card).getByText('stale cache')).toBeInTheDocument();
    expect(
      within(card).getByRole('list', { name: 'Conversion path: EUR → UAH → PLN' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/Monobank was unreachable, so the last good snapshot was used/i),
    ).toBeInTheDocument();
    expect(within(card).getByText(/the rate was derived through UAH/i)).toBeInTheDocument();
  });

  it('announces one sentence rather than reading the whole card out', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const announcement = await screen.findByText('100.00 EUR is 425.71 PLN');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    // The result pane is a sibling, not a child: it stays there to be read,
    // and is not what gets read out.
    const result = screen.getByRole('group', { name: 'Result' });
    expect(announcement).not.toContainElement(result);
    expect(result.closest('[aria-live]')).toBeNull();
  });

  it('does not throw on a strategy or source it has never heard of', async () => {
    const user = userEvent.setup();
    renderPage({
      convert: {
        ...conversion,
        strategy: 'triangular' as ConvertResponse['strategy'],
        source: 'mirror' as ConvertResponse['source'],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const card = await findAnsweredCard();
    expect(within(card).getByText('triangular')).toBeInTheDocument();
    expect(within(card).getByText('mirror')).toBeInTheDocument();
    expect(
      within(card).getByRole('list', { name: 'Conversion path: EUR → PLN' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/does not recognise the strategy the API reported/i),
    ).toBeInTheDocument();
  });

  it('draws no path for identity, which converted nothing', async () => {
    const user = userEvent.setup();
    renderPage({
      convert: { ...conversion, from: 'EUR', to: 'EUR', strategy: 'identity', result: 100 },
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const card = await findAnsweredCard();
    expect(within(card).queryByRole('list', { name: /Conversion path/ })).not.toBeInTheDocument();
    // The provenance note still says why there is nothing to draw.
    expect(within(card).getByText(/nothing was converted/i)).toBeInTheDocument();
  });

  it('routes validation messages onto the inputs they belong to', async () => {
    const user = userEvent.setup();
    renderPage({
      convert: new ApiError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          errors: [
            { field: 'amount', messages: ['amount must be a positive number'] },
            { field: 'to', messages: ['to must be an ISO 4217 code'] },
            { field: 'mystery', messages: ['nothing on this form owns that'] },
          ],
        },
        requestId: 'req-42',
      }),
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const amount = await screen.findByLabelText('Amount');
    await waitFor(() => {
      expect(amount).toHaveAttribute('aria-invalid', 'true');
    });
    expect(amount).toHaveAttribute('aria-describedby', 'amount-hint amount-error');
    expect(document.getElementById('amount-error')).toHaveTextContent(
      'amount must be a positive number',
    );

    const to = screen.getByLabelText('To');
    expect(to).toHaveAttribute('aria-invalid', 'true');
    expect(to).toHaveAttribute('aria-describedby', 'to-error');
    expect(document.getElementById('to-error')).toHaveTextContent('to must be an ISO 4217 code');

    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'false');

    const notice = screen
      .getAllByRole('alert')
      .find((alert) => alert.textContent?.includes('VALIDATION_ERROR'));
    expect(notice).toHaveTextContent('The request did not pass validation.');
    expect(notice).toHaveTextContent('nothing on this form owns that');
    expect(notice).not.toHaveTextContent('amount must be a positive number');
    expect(notice).toHaveTextContent('request req-42');
  });

  it('clears a server error on the field the user has since edited', async () => {
    const user = userEvent.setup();
    renderPage({
      convert: new ApiError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          errors: [
            { field: 'amount', messages: ['amount must be a positive number'] },
            { field: 'to', messages: ['to must be an ISO 4217 code'] },
          ],
        },
      }),
    });
    await screen.findAllByRole('option', { name: 'EUR — Euro' });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const amount = await screen.findByLabelText('Amount');
    await waitFor(() => {
      expect(amount).toHaveAttribute('aria-invalid', 'true');
    });

    await user.type(amount, '5');

    expect(amount).toHaveAttribute('aria-invalid', 'false');
    expect(amount).toHaveAttribute('aria-describedby', 'amount-hint');
    expect(document.getElementById('amount-error')).toBeNull();

    // The untouched field still carries what the server said about it.
    expect(screen.getByLabelText('To')).toHaveAttribute('aria-invalid', 'true');

    await user.selectOptions(screen.getByLabelText('To'), 'PLN');

    expect(screen.getByLabelText('To')).toHaveAttribute('aria-invalid', 'false');
  });

  it('puts the server errors back when the corrected values fail again', async () => {
    const user = userEvent.setup();
    renderPage({
      convert: new ApiError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { errors: [{ field: 'amount', messages: ['amount must be a positive number'] }] },
      }),
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const amount = await screen.findByLabelText('Amount');
    await waitFor(() => {
      expect(amount).toHaveAttribute('aria-invalid', 'true');
    });

    await user.type(amount, '5');
    expect(amount).toHaveAttribute('aria-invalid', 'false');

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(amount).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('stays usable when the currency list fails to load', async () => {
    const user = userEvent.setup();
    const fake = renderPage({
      currencies: new ApiError({
        statusCode: 0,
        code: 'NETWORK_ERROR',
        message: 'Cannot reach the API.',
      }),
    });

    expect(await screen.findByText(/The currency list did not load/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(fake.convertCalls).toEqual([{ from: 'USD', to: 'UAH', amount: 100 }]);
    });
  });
});

describe('the currency list', () => {
  const STALE_AT = Date.now() - 10 * 60 * 1000;

  const unreachable = new ApiError({
    statusCode: 404,
    code: 'NOT_FOUND',
    message: 'Cannot GET /api/v1/currencies',
  });

  it('uses the copy saved in this browser before it falls back to the defaults', async () => {
    const queryClient = createTestQueryClient();
    // Hydrated from storage, so it is stale on arrival and the page refetches it.
    queryClient.setQueryData(queryKeys.currencies, currencies, { updatedAt: STALE_AT });
    const fake = createFakeServices({ currencies: unreachable });

    renderWithProviders(<ConverterPage />, { services: fake.services, queryClient });

    const from = await screen.findByLabelText('From');
    expect(
      within(from)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['EUR — Euro', 'PLN — Zloty', 'UAH — Hryvnia', 'USD — US Dollar']);
    expect(
      await screen.findByText(/The copy saved in this browser is being used/),
    ).toBeInTheDocument();
  });

  it('falls back to the two defaults when nothing has been saved', async () => {
    renderPage({ currencies: unreachable });

    const from = await screen.findByLabelText('From');
    expect(
      within(from)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['USD', 'UAH']);
    expect(screen.getByLabelText('To')).toHaveValue('UAH');
  });

  it('translates why the list is missing instead of quoting the server', async () => {
    renderPage({ currencies: unreachable });

    expect(await screen.findByText(/The API does not have that endpoint\./)).toBeInTheDocument();
    expect(screen.queryByText(/Cannot GET/)).not.toBeInTheDocument();
  });

  it('shows a code on its own when the API has no name for it', async () => {
    renderPage({
      currencies: {
        currencies: [
          { code: 'USD', numericCode: 840, name: 'USD' },
          { code: 'XDR', numericCode: 960, name: 'XDR' },
        ],
      },
    });

    const from = await screen.findByLabelText('From');
    await waitFor(() => {
      expect(
        within(from)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['USD', 'XDR']);
    });
  });
});

describe('while the currency list is loading', () => {
  it('stands the selects in a status region rather than labelling nothing', () => {
    const fake = createFakeServices({ convert: conversion });
    renderWithProviders(<ConverterPage />, {
      services: {
        ...fake.services,
        currencies: { list: () => new Promise<CurrenciesResponse>(() => undefined) },
      },
    });

    const [from, to] = screen.getAllByRole('status');
    expect(from).toHaveTextContent('Loading the currency list for From…');
    expect(to).toHaveTextContent('Loading the currency list for To…');
    // No control to name yet, so nothing claims to name one.
    expect(document.querySelectorAll('label[for="from"], label[for="to"]')).toHaveLength(0);
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  });
});

describe('warnings on a successful answer', () => {
  it('says what degraded while the conversion was answered', async () => {
    const user = userEvent.setup();
    renderPage({
      convert: {
        ...conversion,
        warnings: [
          { code: 'HISTORY_NOT_RECORDED', message: 'Raw server sentence, not for a reader.' },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const card = await findAnsweredCard();
    // The answer still stands; the note is what it cost.
    expect(card).toHaveTextContent('425.71 PLN');
    expect(
      within(card).getByText(/could not be saved, so it will not appear under recent conversions/i),
    ).toBeInTheDocument();
    expect(within(card).queryByText('Raw server sentence, not for a reader.')).toBeNull();
  });

  it('shows the server sentence for a warning code it does not know', async () => {
    const user = userEvent.setup();
    renderPage({
      convert: {
        ...conversion,
        warnings: [
          {
            // A code the API grew after this client shipped.
            code: 'CLOCK_SKEW' as ResponseWarningCode,
            message: 'The rate clock drifted while this was answered.',
          },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(
      await screen.findByText('The rate clock drifted while this was answered.'),
    ).toBeInTheDocument();
  });

  it('says nothing at all when nothing degraded', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const card = await findAnsweredCard();
    expect(within(card).queryByText(/could not be reached/i)).toBeNull();
  });

  it('carries a list warning under the form, once, however many lists report it', async () => {
    const snapshot: RatesSnapshotResponse = {
      ...FAKE_RESPONSES.rates,
      source: 'provider',
      rates: [],
      warnings: [{ code: 'CACHE_UNAVAILABLE', message: 'Server sentence.' }],
    };
    renderPage({
      currencies: {
        ...currencies,
        warnings: [{ code: 'CACHE_UNAVAILABLE', message: 'Server sentence.' }],
      },
      rates: snapshot,
    });

    // One line, not one per query that noticed the same cache was down.
    const notes = await screen.findAllByText(/The rates cache could not be reached/i);
    expect(notes).toHaveLength(1);
    expect(screen.queryByText('Server sentence.')).toBeNull();
  });
});

describe('the amount field', () => {
  it('refuses a character even when the value it would leave is unchanged', async () => {
    const user = userEvent.setup();
    renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.type(amount, 'x');

    expect(amount).toHaveValue('100');
  });

  it('takes the digit after the separator when delete lands on one', async () => {
    const user = userEvent.setup();
    renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.type(amount, '1234');
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{Delete}');

    expect(amount).toHaveValue('134');
  });

  it('leaves a selection to the browser to replace', async () => {
    const user = userEvent.setup();
    renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.type(amount, '1234');
    await user.keyboard('{Control>}a{/Control}{Backspace}');

    expect(amount).toHaveValue('');
  });

  it('groups thousands as they are typed and sends the number behind them', async () => {
    const user = userEvent.setup();
    const fake = renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.type(amount, '1234567.891');

    // The third decimal never lands, and the grouping is the locale's.
    expect(amount).toHaveValue('1,234,567.89');

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(fake.convertCalls).toEqual([{ from: 'USD', to: 'UAH', amount: 1234567.89 }]);
    });
  });

  it('accepts a pasted amount and throws away everything around it', async () => {
    const user = userEvent.setup();
    renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.click(amount);
    await user.paste('  $1,234,567.899  ');

    expect(amount).toHaveValue('1,234,567.89');
  });

  it('takes the digit with the separator when backspace lands on one', async () => {
    const user = userEvent.setup();
    renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.type(amount, '1234');
    expect(amount).toHaveValue('1,234');

    // Caret to just after the separator, where backspace would otherwise do nothing.
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{Backspace}');

    expect(amount).toHaveValue('234');
  });

  it('drops a decimal separator left dangling when the field is left', async () => {
    const user = userEvent.setup();
    renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.type(amount, '12.');
    expect(amount).toHaveValue('12.');

    await user.tab();

    expect(amount).toHaveValue('12');
  });

  it('submits the number in front of a dangling separator when Enter skips the blur', async () => {
    const user = userEvent.setup();
    const fake = renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.type(amount, '12.{Enter}');

    // The field still shows what was typed — only blur tidies that — and the
    // form has already sent the number it stands for.
    expect(amount).toHaveValue('12.');
    await waitFor(() => {
      expect(fake.convertCalls).toEqual([{ from: 'USD', to: 'UAH', amount: 12 }]);
    });
    expect(screen.queryByText('Enter a number, for example 250.75.')).not.toBeInTheDocument();
  });

  it('sends the number behind the grouping when Enter follows a dangling separator', async () => {
    const user = userEvent.setup();
    const fake = renderPage();
    const amount = screen.getByLabelText('Amount');

    await user.clear(amount);
    await user.type(amount, '1234.{Enter}');

    expect(amount).toHaveValue('1,234.');
    await waitFor(() => {
      expect(fake.convertCalls).toEqual([{ from: 'USD', to: 'UAH', amount: 1234 }]);
    });
  });

  it('describes what the field accepts', () => {
    renderPage();

    expect(screen.getByLabelText('Amount')).toHaveAttribute('inputmode', 'decimal');
    expect(document.getElementById('amount-hint')).toHaveTextContent(
      'Numbers only, up to 13 digits and 2 decimal places.',
    );
  });
});

describe('while a conversion is in flight', () => {
  it('says so on the button and stops a second submission', async () => {
    const user = userEvent.setup();
    const fake = createFakeServices({ currencies });
    renderWithProviders(<ConverterPage />, {
      services: {
        ...fake.services,
        conversion: { convert: () => new Promise<ConvertResponse>(() => undefined) },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const button = await screen.findByRole('button', { name: 'Converting…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
