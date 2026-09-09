import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ConvertResponse } from '../../../api';
import { createFakeServices, FAKE_RESPONSES } from '../../../test/fakes/createFakeServices';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ConverterPage } from '../components/ConverterPage';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../index.css'),
  'utf8',
);

const conversion: ConvertResponse = { ...FAKE_RESPONSES.convert };
delete conversion.warnings;

function renderPage(options = {}) {
  const fake = createFakeServices({
    currencies: FAKE_RESPONSES.currencies,
    convert: conversion,
    ...options,
  });
  renderWithProviders(<ConverterPage />, { services: fake.services });
  return fake;
}

/** The card is the one form on the page: both panes, the seam and the footer. */
function card(): HTMLElement {
  const form = document.querySelector('form');
  if (form === null) {
    throw new Error('the converter card is not on the page');
  }
  return form;
}

function blocks(): HTMLElement[] {
  return [...card().children] as HTMLElement[];
}

/** The card's nth block, by the class index.css assigns its grid area to. */
function block(name: string): HTMLElement {
  const found = blocks().find((element) => element.classList.contains(`pane-${name}`));
  if (found === undefined) {
    throw new Error(`the card has no ${name} block`);
  }
  return found;
}

describe('the two-pane card', () => {
  it('stacks input, seam, output and action in that order, which is the mobile layout', async () => {
    renderPage();
    await screen.findByLabelText('From');

    const [input, seam, output, action] = blocks();
    expect(input).toBe(block('input'));
    expect(output).toBe(block('output'));
    expect(action).toBe(block('action'));

    expect(within(block('input')).getByLabelText('From')).toBeInTheDocument();
    expect(within(block('input')).getByLabelText('Amount')).toBeInTheDocument();
    expect(within(block('output')).getByLabelText('To')).toBeInTheDocument();
    expect(within(block('output')).getByRole('group', { name: 'Result' })).toBeInTheDocument();

    // Convert is below both panes in the source, which is where a stacked
    // layout puts it: after what you gave and what you got, not between them.
    expect(within(block('action')).getByRole('button', { name: 'Convert' })).toBeInTheDocument();
    expect(seam).toContainElement(screen.getByRole('button', { name: 'Swap the two currencies' }));
  });

  it('puts the swap control on the seam rather than inside either pane', () => {
    renderPage();

    const seam = blocks()[1];
    const swap = screen.getByRole('button', { name: 'Swap the two currencies' });

    expect(block('input')).not.toContainElement(swap);
    expect(block('output')).not.toContainElement(swap);
    expect(seam).toContainElement(swap);
  });

  it('is laid out as two columns above the collapse breakpoint, by the areas index.css names', () => {
    renderPage();

    expect(card()).toHaveClass('converter-card');
    // The four names the grid areas above 640px are assigned to; without them
    // the card would stay stacked at every width.
    expect(css).toMatch(
      /@media \(min-width: 40rem\) \{[\s\S]*grid-template-areas:\s*'input output'\s*'action output'\s*'footer footer';/,
    );
    for (const area of ['input', 'action', 'output', 'footer']) {
      expect(css).toContain(`grid-area: ${area};`);
    }
  });

  it('holds the answer slot open with the sentence saying what will fill it', () => {
    renderPage();

    const result = screen.getByRole('group', { name: 'Result' });
    expect(result).toHaveTextContent('—');
    expect(result).toHaveTextContent('Rate, strategy and source appear here once you convert.');
    expect(screen.queryByText('Strategy')).not.toBeInTheDocument();
  });

  it('fills the same pane rather than opening a second card below it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Result' })).toHaveTextContent('425.71 PLN');
    });
    expect(card()).toContainElement(screen.getByRole('group', { name: 'Result' }));
    expect(document.querySelectorAll('form')).toHaveLength(1);

    const footer = block('footer');
    expect(blocks().indexOf(footer)).toBe(blocks().length - 1);
    expect(within(footer).getByText('Strategy')).toBeInTheDocument();
    expect(
      within(footer).getByRole('list', { name: 'Conversion path: EUR → UAH → PLN' }),
    ).toBeInTheDocument();
  });

  it('stands the answer in while one is on its way, and hides the badges until it lands', async () => {
    const user = userEvent.setup();
    const fake = createFakeServices({ currencies: FAKE_RESPONSES.currencies });
    renderWithProviders(<ConverterPage />, {
      services: {
        ...fake.services,
        conversion: { convert: () => new Promise<ConvertResponse>(() => undefined) },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const result = await screen.findByRole('group', { name: 'Result' });
    await waitFor(() => {
      expect(within(result).getByRole('status')).toHaveTextContent('Converting…');
    });
    expect(result.querySelectorAll('.skeleton')).toHaveLength(3);
    expect(within(result).queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('cross')).not.toBeInTheDocument();
  });

  it('lifts the badges off the sunken pane they sit on', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    // A neutral chip on the sunken output pane would otherwise be the same
    // colour as its ground (§6.4).
    expect(await screen.findByText('cross')).toHaveClass('badge', 'badge-on-sunken');
    expect(screen.getByText('stale cache')).toHaveClass('badge-warn', 'badge-on-sunken');
  });
});
