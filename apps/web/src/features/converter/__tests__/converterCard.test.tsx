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

/** The two select triggers' own glyphs, which nothing on the card takes away. */
function chevrons(): Element[] {
  return [...card().querySelectorAll('.control-select + svg')];
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

  it('keeps the phone card padded under Convert before there is a footer to pad it', async () => {
    renderPage();
    await screen.findByLabelText('From');

    // Nothing has been converted, so the action block is the card's last child.
    // `last:pb-5` is what puts board 1k's 20px under the button there; the
    // `pb-0` it replaced assumed a provenance footer that does not exist yet.
    const action = block('action');
    expect(blocks().indexOf(action)).toBe(blocks().length - 1);
    expect(action).toHaveClass('last:pb-5', 'sm:pb-6');
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
    // The dash draws the empty slot and the sentence says what it is, so only
    // one of the two is read out.
    expect(within(result).getByText('—')).toHaveAttribute('aria-hidden', 'true');
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

  it('stands the answer in while the first one is on its way', async () => {
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

  it('shortens the fetched line for a phone and keeps the long one beside it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const footer = await screen.findByText(/Rates fetched/);
    const short = within(block('footer')).getByText(/^Fetched /);

    // Board 1i's wording under 640 and the card's above it. One of the two is
    // `display: none` at any width, so only one is read out — and both read
    // the clock as 24 hours.
    expect(short).toHaveClass('sm:hidden');
    expect(footer).toHaveClass('hidden', 'sm:inline');
    expect(short).toHaveTextContent(/^Fetched .*\d{2}:\d{2}$/);
    expect(footer).toHaveTextContent(/on .*\d{2}:\d{2}$/);
  });

  it('leaves the form exactly as it was while the answer is on its way', async () => {
    const user = userEvent.setup();
    const fake = createFakeServices({ currencies: FAKE_RESPONSES.currencies });
    renderWithProviders(<ConverterPage />, {
      services: {
        ...fake.services,
        conversion: { convert: () => new Promise<ConvertResponse>(() => undefined) },
      },
    });

    await screen.findByLabelText('From');
    const amount = screen.getByLabelText('Amount');
    const described = amount.getAttribute('aria-describedby');
    expect(amount).toHaveAccessibleDescription(/Numbers only/);
    expect(chevrons()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const button = screen.getByRole('button', { name: 'Converting…' });
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    // Only the button says a conversion is in flight. The field keeps its
    // size, its hint keeps describing it, and both triggers keep the glyph
    // that would otherwise be taken away and put back on every press.
    expect(amount.parentElement).not.toHaveClass('opacity-60');
    expect(screen.getByText(/Numbers only/)).toBeInTheDocument();
    expect(amount).toHaveAccessibleDescription(/Numbers only/);
    expect(amount.getAttribute('aria-describedby')).toBe(described);
    expect(chevrons()).toHaveLength(2);
  });

  it('replaces the figures inside the pane already standing, without remounting it', async () => {
    const user = userEvent.setup();
    const fake = createFakeServices({ currencies: FAKE_RESPONSES.currencies });
    const answers: ConvertResponse[] = [
      conversion,
      { ...conversion, amount: 200, result: 851.42, rate: 4.2571 },
    ];
    renderWithProviders(<ConverterPage />, {
      services: {
        ...fake.services,
        conversion: { convert: () => Promise.resolve(answers.shift() ?? conversion) },
      },
    });

    await screen.findByLabelText('From');
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const pane = await screen.findByRole('group', { name: 'Result' });
    await waitFor(() => {
      expect(pane).toHaveTextContent('425.71 PLN');
    });
    const figure = within(pane).getByText(/425\.71/);
    const footer = block('footer');

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(pane).toHaveTextContent('851.42 PLN');
    });
    // The same three nodes with new text in them: no key change, so no
    // remount, so no entrance for the answer to replay and nothing under the
    // pane to be pushed down by one.
    expect(screen.getByRole('group', { name: 'Result' })).toBe(pane);
    expect(within(pane).getByText(/851\.42/)).toBe(figure);
    expect(block('footer')).toBe(footer);
  });

  it('keeps the answer on screen while the next one is on its way', async () => {
    const user = userEvent.setup();
    const fake = createFakeServices({ currencies: FAKE_RESPONSES.currencies });
    let settle: ((answer: ConvertResponse) => void) | undefined;
    const answers = [
      Promise.resolve(conversion),
      new Promise<ConvertResponse>((resolve) => {
        settle = resolve;
      }),
    ];
    renderWithProviders(<ConverterPage />, {
      services: {
        ...fake.services,
        conversion: { convert: () => answers.shift() ?? Promise.resolve(conversion) },
      },
    });

    await screen.findByLabelText('From');
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByText('cross')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Converting…' })).toBeDisabled();
    });
    // Nothing steps out of the card and back into it around a request: the
    // figure, the badges and the provenance footer are all still there.
    const pane = screen.getByRole('group', { name: 'Result' });
    expect(pane).toHaveTextContent('425.71 PLN');
    expect(pane.querySelectorAll('.skeleton')).toHaveLength(0);
    expect(screen.getByText('cross')).toBeInTheDocument();
    expect(within(block('footer')).getByText('Strategy')).toBeInTheDocument();

    settle?.(conversion);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Convert' })).toBeEnabled();
    });
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
