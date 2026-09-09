import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api';
import type { HealthResponse, RatesSnapshotResponse } from '../../../api';
import {
  createFakeServices,
  FAKE_RESPONSES,
  type FakeServicesOptions,
} from '../../../test/fakes/createFakeServices';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { OpsPage } from '../components/OpsPage';
import { FRESH_TTL_MS } from '../lib/snapshotTtl';

const SECRET = 'super-secret-admin-key';

const healthy: HealthResponse = {
  status: 'ok',
  info: {
    redis: { status: 'up' },
    mongodb: { status: 'up' },
    monobank: { status: 'up' },
  },
  error: {},
  details: {
    redis: { status: 'up' },
    mongodb: { status: 'up' },
    monobank: { status: 'up' },
  },
};

const degraded: HealthResponse = {
  status: 'error',
  info: { redis: { status: 'up' }, mongodb: { status: 'up' } },
  error: { monobank: { status: 'down', reason: 'circuit open' } },
  details: {
    redis: { status: 'up' },
    mongodb: { status: 'up' },
    monobank: { status: 'down', reason: 'circuit open' },
  },
};

/** A snapshot fetched just now, so the fresh key is still counting down. */
function freshSnapshot(): RatesSnapshotResponse {
  return { ...FAKE_RESPONSES.rates, source: 'cache', fetchedAt: new Date().toISOString() };
}

function staleSnapshot(): RatesSnapshotResponse {
  return {
    ...FAKE_RESPONSES.rates,
    source: 'stale-cache',
    fetchedAt: new Date(Date.now() - FRESH_TTL_MS - 60_000).toISOString(),
  };
}

function renderOps(overrides: FakeServicesOptions = {}) {
  // The options object is handed back as well as used, so a case that needs the
  // second answer to differ from the first can change it in place.
  const options: FakeServicesOptions = {
    health: healthy,
    rates: freshSnapshot(),
    currencies: FAKE_RESPONSES.currencies,
    ...overrides,
  };
  const fake = createFakeServices(options);
  renderWithProviders(<OpsPage />, { services: fake.services });
  return { ...fake, options };
}

/** Everything the browser has written down, whatever it was written under. */
function storedValues(): string {
  const dump: string[] = [];
  for (const store of [localStorage, sessionStorage]) {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      dump.push(key ?? '', key === null ? '' : (store.getItem(key) ?? ''));
    }
  }
  return dump.join('\n');
}

async function clearCache(user: ReturnType<typeof userEvent.setup>, key = SECRET) {
  await user.type(screen.getByLabelText('Admin API key'), key);
  await user.click(await screen.findByRole('button', { name: /Clear cache…/ }));
  await user.click(await screen.findByRole('button', { name: 'Clear cache' }));
}

describe('OpsPage health card', () => {
  it('reports the status the report implies, and every indicator under it', async () => {
    renderOps();

    expect(await screen.findByText('API reports every dependency up')).toBeInTheDocument();
    const card = screen.getByRole('region', { name: /Health/ });
    expect(within(card).getByText(/^200 · /)).toBeInTheDocument();
    expect(within(card).getByText('Redis')).toBeInTheDocument();
    expect(within(card).getByText('rates cache · fresh key + fallback key')).toBeInTheDocument();
    expect(within(card).getByText('conversion history')).toBeInTheDocument();
    // The state the API never names: derived from the indicator's own reason.
    expect(within(card).getAllByText('CLOSED').length).toBeGreaterThan(0);
    expect(within(card).getAllByText('up')).toHaveLength(3);
  });

  it('says 503 and names the open circuit when a dependency is down', async () => {
    renderOps({ health: degraded });

    expect(await screen.findByText('API reports a degraded dependency')).toBeInTheDocument();
    const card = screen.getByRole('region', { name: /Health/ });
    expect(within(card).getByText(/^503 · /)).toBeInTheDocument();
    expect(within(card).getAllByText('OPEN').length).toBeGreaterThan(0);
    expect(within(card).getByText('down')).toBeInTheDocument();
  });

  it('shows the sanitised reason a down dependency sent with itself', async () => {
    renderOps({
      health: {
        status: 'error',
        details: { redis: { status: 'down', reason: 'timeout' }, mongodb: { status: 'up' } },
      },
    });

    expect(
      await screen.findByText('rates cache · fresh key + fallback key · timeout'),
    ).toBeInTheDocument();
  });

  it('says the endpoint did not answer rather than pretending it did', async () => {
    renderOps({
      health: new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Cannot reach it.' }),
    });

    expect(await screen.findByText('The health endpoint did not answer.')).toBeInTheDocument();
  });

  it('rechecks on demand, which is the same query the About card polls', async () => {
    const user = userEvent.setup();
    renderOps();
    await screen.findByText('API reports every dependency up');

    await user.click(screen.getByRole('button', { name: /Recheck now|Rechecking…/ }));

    await waitFor(() => {
      expect(screen.getByText('API reports every dependency up')).toBeInTheDocument();
    });
  });
});

describe('OpsPage snapshot card', () => {
  it('derives both TTLs from the fetch time and says that it did', async () => {
    renderOps();

    const card = await screen.findByRole('region', { name: /Rate snapshot/ });
    expect(await within(card).findByText('Fresh key expires')).toBeInTheDocument();
    expect(within(card).getByText('TTL 5 min')).toBeInTheDocument();
    expect(within(card).getByText('TTL 24 h')).toBeInTheDocument();
    expect(within(card).getByText(/worked out in this browser/)).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('counts the currencies the list actually holds', async () => {
    renderOps();

    expect(
      await screen.findByText(/^4 currencies, every pair crossed through UAH/),
    ).toBeInTheDocument();
  });

  it('warns that a stale snapshot is the only thing left to fall back on', async () => {
    renderOps({ rates: staleSnapshot(), health: degraded });

    expect(
      await screen.findByText(
        'Clearing now would leave nothing to fall back on while Monobank is unreachable.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('expired')).toBeInTheDocument();
  });

  it('does not cry stale over a derived TTL the API has not confirmed', async () => {
    // The snapshot is older than the documented five minutes, but the API is
    // still answering `cache` and Monobank is up: nothing is at risk, and the
    // derivation is not entitled to say otherwise.
    renderOps({
      rates: {
        ...FAKE_RESPONSES.rates,
        source: 'cache',
        fetchedAt: new Date(Date.now() - FRESH_TTL_MS - 60_000).toISOString(),
      },
    });

    expect(await screen.findByText('expired')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Clearing now would leave nothing to fall back on while Monobank is unreachable.',
      ),
    ).not.toBeInTheDocument();
  });

  it('cannot send the command without a key', async () => {
    renderOps();

    const button = await screen.findByRole('button', { name: /Clear cache…/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('no key');
  });
});

describe('OpsPage clear-cache dialog', () => {
  it('confirms before it sends, with focus on Cancel and the key masked', async () => {
    const user = userEvent.setup();
    renderOps();

    await user.type(screen.getByLabelText('Admin API key'), SECRET);
    await user.click(await screen.findByRole('button', { name: /Clear cache…/ }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Clear the rates cache?');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByText('DELETE /api/v1/rates/cache')).toBeInTheDocument();
    expect(within(dialog).getByText(/x-api-key: •+$/)).toBeInTheDocument();
    expect(within(dialog).queryByText(new RegExp(SECRET))).not.toBeInTheDocument();
  });

  it('sends nothing when it is dismissed with Escape', async () => {
    const user = userEvent.setup();
    const fake = renderOps();

    await user.type(screen.getByLabelText('Admin API key'), SECRET);
    await user.click(await screen.findByRole('button', { name: /Clear cache…/ }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fake.clearCacheKeys).toEqual([]);
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderOps();

    await user.type(screen.getByLabelText('Admin API key'), SECRET);
    await user.click(await screen.findByRole('button', { name: /Clear cache…/ }));
    const dialog = screen.getByRole('dialog');

    for (let step = 0; step < 4; step += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('answers a 204 by saying what it means and logging what was sent', async () => {
    const user = userEvent.setup();
    const fake = renderOps();

    await clearCache(user);

    expect(
      await screen.findByText('Cache cleared. The next conversion fetches from Monobank.'),
    ).toBeInTheDocument();
    expect(screen.getByText('204 · request req-42')).toBeInTheDocument();
    expect(fake.clearCacheKeys).toEqual([SECRET]);

    const log = screen.getByRole('region', { name: 'Actions this session' });
    expect(within(log).getByText('DELETE /api/v1/rates/cache')).toBeInTheDocument();
    expect(within(log).getByText('204 cleared')).toBeInTheDocument();
  });

  it('answers a 401 with the envelope’s own sentence and puts the caret on the key', async () => {
    const user = userEvent.setup();
    renderOps({
      clearCache: new ApiError({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        requestId: '3b8fc0de-0000-0000-0000-0000000000a2',
      }),
    });

    await clearCache(user, 'wrong-key');

    expect(await screen.findByText('This request needs an admin API key.')).toBeInTheDocument();
    expect(screen.getByText('401 UNAUTHORIZED · request 3b8f…a2')).toBeInTheDocument();

    const field = screen.getByLabelText('Admin API key');
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');

    const log = screen.getByRole('region', { name: 'Actions this session' });
    expect(within(log).getByText('401 unauthorized')).toBeInTheDocument();
  });

  it('answers a 503 by saying the keys are still there', async () => {
    const user = userEvent.setup();
    renderOps({
      clearCache: new ApiError({
        statusCode: 503,
        code: 'CACHE_UNAVAILABLE',
        message: 'The cache could not be reached.',
      }),
    });

    await clearCache(user);

    expect(
      await screen.findByText('The rates cache could not be reached, so it could not be cleared.'),
    ).toBeInTheDocument();
    expect(screen.getByText('503 CACHE_UNAVAILABLE')).toBeInTheDocument();
    // The key is not what went wrong, so it is not what gets blamed.
    expect(screen.getByLabelText('Admin API key')).toHaveAttribute('aria-invalid', 'false');
  });

  it('clears the 401 the moment the key is edited', async () => {
    const user = userEvent.setup();
    renderOps({
      clearCache: new ApiError({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    });

    await clearCache(user, 'wrong-key');
    await screen.findByText('This request needs an admin API key.');

    await user.type(screen.getByLabelText('Admin API key'), '!');

    expect(screen.getByLabelText('Admin API key')).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('the admin key', () => {
  it('is never written to storage, in either form', async () => {
    const user = userEvent.setup();
    renderOps();

    await clearCache(user);
    await screen.findByText('Cache cleared. The next conversion fetches from Monobank.');

    expect(storedValues()).not.toContain(SECRET);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('is masked until it is asked for, and forgotten on demand', async () => {
    const user = userEvent.setup();
    renderOps();

    const field = screen.getByLabelText('Admin API key');
    await user.type(field, SECRET);
    expect(field).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show the key' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveValue(SECRET);

    await user.click(screen.getByRole('button', { name: 'Forget' }));
    expect(field).toHaveValue('');
    expect(screen.getByRole('button', { name: /Clear cache…/ })).toBeDisabled();
  });
});

describe('the session action log', () => {
  it('starts empty and says it is not kept', async () => {
    renderOps();

    const log = await screen.findByRole('region', { name: 'Actions this session' });
    expect(within(log).getByText('Not persisted')).toBeInTheDocument();
    expect(within(log).getByText('Nothing has been sent from this page yet.')).toBeInTheDocument();
  });

  it('puts the newest answer at the top', async () => {
    const user = userEvent.setup();
    const page = renderOps({
      clearCache: new ApiError({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' }),
    });

    await clearCache(user, 'wrong-key');
    await screen.findByText('This request needs an admin API key.');

    page.options.clearCache = { status: 204, requestId: undefined };
    await user.click(await screen.findByRole('button', { name: /Clear cache…/ }));
    await user.click(await screen.findByRole('button', { name: 'Clear cache' }));
    await screen.findByText('Cache cleared. The next conversion fetches from Monobank.');

    const rows = within(screen.getByRole('region', { name: 'Actions this session' })).getAllByRole(
      'listitem',
    );
    expect(rows[0]).toHaveTextContent('204 cleared');
    expect(rows[1]).toHaveTextContent('401 unauthorized');
  });

  it('leaves the request id off a success the browser was not allowed to read', async () => {
    const user = userEvent.setup();
    renderOps({ clearCache: { status: 204, requestId: undefined } });

    await clearCache(user);
    await screen.findByText('Cache cleared. The next conversion fetches from Monobank.');

    const answer = screen.getByRole('status');
    expect(within(answer).getByText('204')).toBeInTheDocument();
    expect(within(answer).queryByText(/request/)).not.toBeInTheDocument();
  });
});
