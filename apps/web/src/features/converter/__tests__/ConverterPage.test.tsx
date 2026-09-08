import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api/http/ApiError';
import type { ConvertResponse, CurrenciesResponse } from '../../../api/types';
import {
  createFakeRepositories,
  type FakeRepositoriesOptions,
} from '../../../test/fakes/createFakeRepositories';
import { createTestQueryClient, renderWithProviders } from '../../../test/renderWithProviders';
import { queryKeys } from '../../../api/queryKeys';
import { ConverterPage } from '../components/ConverterPage';

const currencies: CurrenciesResponse = {
  currencies: [
    { code: 'EUR', numericCode: 978, name: 'Euro' },
    { code: 'PLN', numericCode: 985, name: 'Zloty' },
    { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
    { code: 'USD', numericCode: 840, name: 'US Dollar' },
  ],
};

const conversion: ConvertResponse = {
  from: 'EUR',
  to: 'PLN',
  amount: 100,
  result: 425.71,
  rate: 4.257112,
  strategy: 'cross',
  source: 'stale-cache',
  ratesTimestamp: '2024-03-05T12:00:00.000Z',
};

function renderPage(options: FakeRepositoriesOptions = {}) {
  const fake = createFakeRepositories({ currencies, convert: conversion, ...options });
  renderWithProviders(<ConverterPage />, { repositories: fake.repositories });
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

    const card = await screen.findByRole('region', { name: 'Result' });
    expect(card.parentElement).toHaveAttribute('aria-live', 'polite');
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

    const card = await screen.findByRole('region', { name: 'Result' });
    expect(within(card).getByText('triangular')).toBeInTheDocument();
    expect(within(card).getByText('mirror')).toBeInTheDocument();
    expect(
      within(card).getByRole('list', { name: 'Conversion path: EUR → PLN' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/does not recognise the strategy the API reported/i),
    ).toBeInTheDocument();
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
    const fake = createFakeRepositories({ currencies: unreachable });

    renderWithProviders(<ConverterPage />, { repositories: fake.repositories, queryClient });

    const from = await screen.findByLabelText('From');
    expect(
      within(from)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['EUR — Euro', 'PLN — Zloty', 'UAH — Hryvnia', 'USD — US Dollar']);
    expect(
      await screen.findByText(/the copy saved in this browser is being used/),
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

  it('describes what the field accepts', () => {
    renderPage();

    expect(screen.getByLabelText('Amount')).toHaveAttribute('inputmode', 'decimal');
    expect(document.getElementById('amount-hint')).toHaveTextContent(
      'Numbers only, up to 2 decimal places, 1,000,000,000,000 maximum.',
    );
  });
});

describe('while a conversion is in flight', () => {
  it('says so on the button and stops a second submission', async () => {
    const user = userEvent.setup();
    const fake = createFakeRepositories({ currencies });
    renderWithProviders(<ConverterPage />, {
      repositories: {
        ...fake.repositories,
        conversion: { convert: () => new Promise<ConvertResponse>(() => undefined) },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const button = await screen.findByRole('button', { name: 'Converting…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
