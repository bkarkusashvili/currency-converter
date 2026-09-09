import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../api';
import type { HealthResponse } from '../../../api';
import {
  createFakeServices,
  FAKE_RESPONSES,
  type FakeServicesOptions,
} from '../../../test/fakes/createFakeServices';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { AboutPage } from '../components/AboutPage';

/**
 * The report this page renders is the one `openapiContract.test.ts` validates
 * against `docs/openapi.json`, with the third indicator the API also reports
 * added — the contract check covers what is on screen rather than a second
 * report beside it.
 */
const healthy: HealthResponse = {
  ...FAKE_RESPONSES.health,
  details: { ...FAKE_RESPONSES.health.details, monobank: { status: 'up' } },
};

function renderAbout(options: FakeServicesOptions = {}) {
  const fake = createFakeServices({ health: healthy, ...options });
  renderWithProviders(<AboutPage />, { services: fake.services });
  return fake;
}

beforeEach(() => {
  window.__APP_CONFIG__ = { apiUrl: 'https://api.test' };
});

describe('AboutPage', () => {
  it('links to the repository, the API docs and both health routes', () => {
    renderAbout();

    expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/bkarkusashvili/currency-converter',
    );
    expect(screen.getByRole('link', { name: /API documentation/i })).toHaveAttribute(
      'href',
      'https://api.test/docs',
    );
    expect(screen.getByRole('link', { name: /Health endpoint/i })).toHaveAttribute(
      'href',
      'https://api.test/health',
    );
    // The dependency report and the liveness probe answer different questions
    // (§3), so the page has to offer both rather than one standing in for the other.
    expect(screen.getByRole('link', { name: /Liveness probe/i })).toHaveAttribute(
      'href',
      'https://api.test/health/live',
    );
  });

  it('reports every indicator the API returns, including ones it has no label for', async () => {
    renderAbout({
      health: {
        status: 'ok',
        details: { ...healthy.details, postgres: { status: 'up' } },
      },
    });

    expect(screen.getByText('Checking the API…')).toBeInTheDocument();

    expect(await screen.findByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('MongoDB')).toBeInTheDocument();
    expect(screen.getByText('Monobank')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('API reports every dependency up')).toBeInTheDocument();
  });

  it('renders an indicator status it does not know as it arrived', async () => {
    renderAbout({
      health: {
        ...healthy,
        status: 'shutting_down',
        details: { redis: { status: 'up' }, monobank: { status: 'degraded' } },
      },
    });

    expect(await screen.findByText('degraded')).toBeInTheDocument();
    expect(screen.getByText('API reports a degraded dependency')).toBeInTheDocument();
  });

  it('shows a degraded API as degraded, not as a failure', async () => {
    renderAbout({
      health: {
        ...healthy,
        status: 'error',
        info: { mongodb: { status: 'up' }, monobank: { status: 'up' } },
        error: { redis: { status: 'down' } },
        details: { ...healthy.details, redis: { status: 'down' } },
      },
    });

    expect(await screen.findByText('API reports a degraded dependency')).toBeInTheDocument();
    expect(screen.getByText('Redis').parentElement).toHaveTextContent('down');
    expect(screen.queryByText(/The health endpoint did not answer/i)).not.toBeInTheDocument();
  });

  it('reports a health endpoint that cannot be reached at all', async () => {
    renderAbout({
      health: ApiError.network('https://api.test/health', new TypeError('Failed to fetch')),
    });

    expect(await screen.findByText(/The health endpoint did not answer/i)).toBeInTheDocument();
  });

  it('renders the written sections', () => {
    renderAbout();

    expect(screen.getByRole('heading', { name: 'Where it stands' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What was built' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Requirements, and where each one is' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Two-layer fallback' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why these decisions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to run it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Process' })).toBeInTheDocument();
  });

  // The page a reviewer is pointed at said modules were still to come long after
  // they had merged. Whatever else it says, it has to say where the work stands.
  it('says the work is merged and deployed rather than in progress', () => {
    renderAbout();

    expect(screen.getByText(/merged on main and deployed/i)).toBeInTheDocument();
    expect(screen.queryByText(/subsequent pull requests/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/in review/i)).not.toBeInTheDocument();
  });

  it('traces each numbered requirement to where it is met', () => {
    renderAbout();

    expect(screen.getByText(/1\. Node backend, NestJS, design patterns/)).toBeInTheDocument();
    expect(screen.getByText(/4\. Caching layer/)).toBeInTheDocument();
    expect(screen.getByText(/8\. Documentation/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the traceability table/i })).toHaveAttribute(
      'href',
      'https://github.com/bkarkusashvili/currency-converter#requirements-traceability',
    );
  });

  // A reviewer should not have to infer this from the commit trailers.
  it('is explicit that the implementation was AI-assisted under review', () => {
    renderAbout();

    expect(screen.getByText(/AI-assisted, under human direction and review/i)).toBeInTheDocument();
    expect(screen.getByText(/Co-Authored-By trailer/i)).toBeInTheDocument();
  });

  it('describes the process in stages and links the full record', () => {
    renderAbout();

    expect(screen.getByRole('heading', { name: 'In stages' })).toBeInTheDocument();
    expect(
      screen.getByText(/architecture contract, written and committed before any implementation/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read the full process record/i })).toHaveAttribute(
      'href',
      'https://github.com/bkarkusashvili/currency-converter/blob/main/docs/process.md',
    );
  });

  // Counts rot. The page keeps them in one table with a date on it, and nowhere
  // else, so a stale number is visible as a stale date rather than as prose.
  it('carries its counts in one dated table', () => {
    renderAbout();

    const table = screen.getByRole('table');
    expect(table).toHaveAccessibleName(expect.stringMatching(/As of 9 September 2026/));
    expect(
      screen.getByRole('rowheader', { name: 'Line-anchored review comments' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Count' })).toBeInTheDocument();
  });

  it('names what the review loop caught, not only that there was one', () => {
    renderAbout();

    expect(
      screen.getByRole('heading', { name: 'Five things the review caught' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Redis rejected its own first command')).toBeInTheDocument();
    expect(screen.getByText('A test that could not fail')).toBeInTheDocument();
  });

  it('names the decisions a reviewer is most likely to ask about', () => {
    renderAbout();

    expect(screen.getByText('No gateway in front')).toBeInTheDocument();
    expect(screen.getByText('Two layers of fallback, not one')).toBeInTheDocument();
    expect(screen.getByText('A warning is not an error')).toBeInTheDocument();
    expect(screen.getByText('Liveness and readiness are different questions')).toBeInTheDocument();
  });

  // "What manages state?" is asked of every React submission, and the answer
  // here is that nothing global does — which is a decision, not an omission.
  it('says what owns state, and why there is no global store', () => {
    renderAbout();

    expect(screen.getByText('State')).toBeInTheDocument();
    expect(screen.getByText(/TanStack Query owns server state/)).toBeInTheDocument();
    expect(
      screen.getByText(/React context provides the service implementations/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no global store because no client state is shared beyond the query cache/),
    ).toBeInTheDocument();
  });

  it('explains both fallbacks and how to see the client one', () => {
    renderAbout();

    expect(screen.getByText(/labels the response stale cache/)).toBeInTheDocument();
    expect(screen.getByText(/set the Network tab in devtools to Offline/)).toBeInTheDocument();
  });

  // Both commands run the whole stack from the repository root. The page used to
  // show how to run this app alone, which is not what a reviewer wants to do.
  it('gives the two root commands that bring the whole thing up', () => {
    renderAbout();

    expect(screen.getByRole('link', { name: /Open the README/i })).toHaveAttribute(
      'href',
      'https://github.com/bkarkusashvili/currency-converter#readme',
    );
    // Matched as one string so the order is asserted too; the block's newlines
    // are collapsed to spaces by the default text normaliser.
    expect(screen.getByText(/npm ci && npm run setup npm run dev/)).toBeInTheDocument();
    expect(screen.getByText(/cd currency-converter docker compose up --build/)).toBeInTheDocument();
    expect(screen.queryByText(/cd currency-converter\/apps\/web/)).not.toBeInTheDocument();
  });
});
