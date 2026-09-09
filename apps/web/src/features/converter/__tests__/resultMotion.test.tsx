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

const second: ConvertResponse = { ...conversion, amount: 200, result: 851.42, rate: 4.2571 };

/** Two different answers, in order, from one press of Convert each. */
function renderTwoAnswers() {
  const fake = createFakeServices({ currencies: FAKE_RESPONSES.currencies });
  const answers: ConvertResponse[] = [conversion, second];
  renderWithProviders(<ConverterPage />, {
    services: {
      ...fake.services,
      conversion: { convert: () => Promise.resolve(answers.shift() ?? second) },
    },
  });
}

function figureRow(pane: HTMLElement): HTMLElement {
  const row = pane.querySelector('p.figure');
  if (row === null) {
    throw new Error('the output pane has no figure row');
  }
  return row as HTMLElement;
}

describe('the answer landing', () => {
  it('replays on the text and on nothing around it', async () => {
    const user = userEvent.setup();
    renderTwoAnswers();

    await screen.findByLabelText('From');
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const pane = await screen.findByRole('group', { name: 'Result' });
    await waitFor(() => {
      expect(pane).toHaveTextContent('425.71 PLN');
    });
    const row = figureRow(pane);
    const first = within(pane).getByText(/425\.71/);
    expect(first).toHaveClass('result-rise');
    // The row is what holds the height; the span inside it is what moves.
    expect(row).not.toHaveClass('result-rise');
    expect(row.contains(first)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Convert' }));
    await waitFor(() => {
      expect(pane).toHaveTextContent('851.42 PLN');
    });

    // The pane and the row keep their identity across the two outcomes: the
    // key is on the span alone, so nothing that carries layout remounts.
    expect(screen.getByRole('group', { name: 'Result' })).toBe(pane);
    expect(figureRow(pane)).toBe(row);

    // The span is a new node, which is what makes the animation run again.
    const next = within(pane).getByText(/851\.42/);
    expect(next).not.toBe(first);
    expect(next).toHaveClass('result-rise');
  });

  it('carries the same replay on both rate lines', async () => {
    const user = userEvent.setup();
    renderTwoAnswers();

    await screen.findByLabelText('From');
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    const pane = await screen.findByRole('group', { name: 'Result' });
    await waitFor(() => {
      expect(pane).toHaveTextContent('425.71 PLN');
    });
    const detail = pane.querySelector('.result-detail');
    const rateLines = () => [...(detail?.querySelectorAll('.result-rise') ?? [])];
    expect(rateLines()).toHaveLength(2);
    const [rate, inverse] = rateLines();

    await user.click(screen.getByRole('button', { name: 'Convert' }));
    await waitFor(() => {
      expect(pane).toHaveTextContent('851.42 PLN');
    });

    expect(pane.querySelector('.result-detail')).toBe(detail);
    const [nextRate, nextInverse] = rateLines();
    expect(nextRate).not.toBe(rate);
    expect(nextInverse).not.toBe(inverse);
  });

  it('moves and fades, changes no size, and is off under prefers-reduced-motion', () => {
    expect(css).toMatch(/\.result-rise \{\s*animation: result-rise 200ms ease-out both;\s*\}/);

    const keyframes = /@keyframes result-rise \{([\s\S]*?)\n\}/.exec(css)?.[1];
    expect(keyframes).toBeDefined();
    // Transform and opacity are the only two properties in the frames, so
    // nothing the animation touches can reflow the pane it runs in.
    const properties = [...(keyframes ?? '').matchAll(/^\s{4}([a-z-]+):/gm)].map(
      (match) => match[1],
    );
    expect([...new Set(properties)].sort()).toEqual(['opacity', 'transform']);
    // 4px up, a 1px overshoot, and settled.
    expect(keyframes).toContain('translateY(4px)');
    expect(keyframes).toContain('translateY(-1px)');
    expect(keyframes).toContain('translateY(0)');

    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}\n/.exec(css)?.[1];
    expect(reduced).toContain('.result-rise');
    expect(reduced).toContain('animation: none !important;');
  });
});
