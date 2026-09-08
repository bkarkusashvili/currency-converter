import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convert, getCurrencies, getHistory } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import type { ConvertResponse } from '../../api/types';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ConverterPage } from './ConverterPage';

vi.mock('../../api/endpoints', () => ({
  convert: vi.fn(),
  getCurrencies: vi.fn(),
  getHistory: vi.fn(),
  getHealth: vi.fn(),
}));

const conversion: ConvertResponse = {
  from: 'EUR',
  to: 'PLN',
  amount: 100,
  result: 425.71,
  rate: 4.257112,
  strategy: 'cross',
  source: 'stale-cache',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
};

beforeEach(() => {
  vi.mocked(getCurrencies).mockResolvedValue({
    currencies: [
      { code: 'EUR', numericCode: 978, name: 'Euro' },
      { code: 'PLN', numericCode: 985, name: 'Zloty' },
      { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
      { code: 'USD', numericCode: 840, name: 'US Dollar' },
    ],
  });
  vi.mocked(getHistory).mockResolvedValue({ items: [] });
  vi.mocked(convert).mockResolvedValue(conversion);
});

describe('ConverterPage', () => {
  it('blocks submission when the amount is not a positive number', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />);

    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '0');
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Amount must be greater than zero.');
    expect(convert).not.toHaveBeenCalled();
  });

  it('submits a normalised payload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />);
    await screen.findAllByRole('option', { name: 'EUR — Euro' });

    await user.selectOptions(screen.getByLabelText('From'), 'EUR');
    await user.selectOptions(screen.getByLabelText('To'), 'PLN');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '250,5');
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(convert).toHaveBeenCalledWith({ from: 'EUR', to: 'PLN', amount: 250.5 });
    });
  });

  it('swaps the two currencies', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />);

    await user.click(screen.getByRole('button', { name: 'Swap the two currencies' }));

    expect(screen.getByLabelText('From')).toHaveValue('UAH');
    expect(screen.getByLabelText('To')).toHaveValue('USD');
  });

  it('renders the result with its rate, path and provenance badges', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />);

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const card = await screen.findByRole('region', { name: 'Result' });
    expect(card).toHaveTextContent('425.71 PLN');
    expect(within(card).getByLabelText('1 EUR equals 4.257112 PLN')).toBeInTheDocument();
    expect(within(card).getByLabelText(/strategy: cross/i)).toBeInTheDocument();
    expect(within(card).getByLabelText(/source: stale cache/i)).toBeInTheDocument();
    expect(within(card).getByLabelText('Conversion path: EUR to UAH to PLN')).toBeInTheDocument();
    expect(
      within(card).getByText(/Monobank was unreachable, so the last good snapshot was used/i),
    ).toBeInTheDocument();
  });

  it('renders the envelope message and per-field messages of a validation error', async () => {
    vi.mocked(convert).mockRejectedValue(
      new ApiError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { errors: [{ field: 'amount', messages: ['amount must be a positive number'] }] },
        requestId: 'req-42',
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />);

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Request validation failed');
    expect(alert).toHaveTextContent('amount must be a positive number');
    expect(alert).toHaveTextContent('VALIDATION_ERROR');
    expect(alert).toHaveTextContent('req-42');
  });

  it('stays usable when the currency list fails to load', async () => {
    vi.mocked(getCurrencies).mockRejectedValue(
      new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Cannot reach the API.' }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ConverterPage />);

    expect(await screen.findByText(/The currency list did not load/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(convert).toHaveBeenCalledWith({ from: 'USD', to: 'UAH', amount: 100 });
    });
  });
});
