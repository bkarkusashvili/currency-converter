import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { setCompactViewport } from '../../../test/viewport';
import { CurrencyCombobox } from '../components/CurrencyCombobox';
import type { CurrencyOption } from '../lib/currencyOptions';

const CURRENCIES: CurrencyOption[] = [
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Pound Sterling' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'UAH', name: 'Hryvnia' },
  { code: 'USD', name: 'US Dollar' },
];

interface HarnessProps {
  currencies?: CurrencyOption[];
  otherValue?: string;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string | null;
  onChange?: (code: string) => void;
}

/** The control with the form state it normally sits in, so a pick is visible. */
function Harness({
  currencies = CURRENCIES,
  otherValue = 'UAH',
  isLoading = false,
  disabled = false,
  error = null,
  onChange,
}: HarnessProps) {
  const [value, setValue] = useState('USD');

  return (
    <CurrencyCombobox
      id="from"
      label="From"
      sheetTitle="From currency"
      value={value}
      currencies={currencies}
      otherValue={otherValue}
      isLoading={isLoading}
      disabled={disabled}
      error={error}
      onChange={(code) => {
        setValue(code);
        onChange?.(code);
      }}
    />
  );
}

function renderCombobox(props: HarnessProps = {}) {
  renderWithProviders(<Harness {...props} />);
  return screen.getByRole('combobox', { name: /^From/ });
}

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../index.css'),
  'utf8',
);

/** The chevron, and the spinner that stands in its box while the list loads. */
function glyph(trigger: HTMLElement): Element | null {
  return trigger.querySelector('.combobox-chevron');
}

function options(): HTMLElement[] {
  return within(screen.getByRole('listbox')).getAllByRole('option');
}

function activeOption(): HTMLElement | undefined {
  return options().find((option) => option.dataset.active === 'true');
}

describe('CurrencyCombobox', () => {
  it('names the listbox it controls only while there is one to name', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    // `aria-controls` on a closed trigger points at an element that is not
    // rendered, which is a dangling reference rather than a relationship.
    expect(trigger).not.toHaveAttribute('aria-controls');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-controls', 'from-listbox');
    expect(document.getElementById('from-listbox')).toBeInTheDocument();
  });

  it('names the control with the pane eyebrow and the currency it holds', () => {
    const trigger = renderCombobox();

    expect(trigger).toHaveAccessibleName('From USD US Dollar');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens on click and moves focus into the search field', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const search = screen.getByPlaceholderText('Search by code or name');
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute('aria-controls', 'from-listbox');
    expect(options()).toHaveLength(CURRENCIES.length);
  });

  it('opens on the down arrow with the current currency already active', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    trigger.focus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(activeOption()).toHaveAttribute('aria-label', 'USD US Dollar');
  });

  it('opens on a printable key and keeps the keystroke as the query', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    trigger.focus();
    await user.keyboard('e');

    expect(screen.getByPlaceholderText('Search by code or name')).toHaveValue('e');
    // EUR by its code, then every name with an `e` in it, in list order.
    expect(options().map((option) => option.getAttribute('aria-label'))).toEqual([
      'EUR Euro',
      'CZK Czech Koruna',
      'DKK Danish Krone',
      'GBP Pound Sterling',
      'SEK Swedish Krona',
    ]);
  });

  it('filters by code prefix first, then by name, and marks the match', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.keyboard('kr');

    const [first, second] = options();
    expect(options()).toHaveLength(2);
    expect(first).toHaveAttribute('aria-label', 'DKK Danish Krone');
    expect(within(first!).getByText('Kr').tagName).toBe('MARK');
    expect(within(second!).getByText('Kr').tagName).toBe('MARK');
  });

  it('marks the code itself when the code is what matched', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.keyboard('eu');

    const [euro] = options();
    expect(within(euro!).getByText('EU').tagName).toBe('MARK');
  });

  it('counts the list, and what is left of it once it is filtered', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    expect(screen.getByText('7 currencies')).toBeInTheDocument();

    await user.keyboard('kr');
    expect(screen.getByText('2 of 7 currencies')).toBeInTheDocument();
  });

  it('says so, in the reader’s own words, when nothing matches', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.keyboard('xyz');

    expect(screen.getByText('No currency matches ‘xyz’.')).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeEmptyDOMElement();
    expect(screen.getByText('0 of 7 currencies')).toBeInTheDocument();
    // Nothing to point at, so nothing is pointed at.
    expect(screen.getByPlaceholderText('Search by code or name')).not.toHaveAttribute(
      'aria-activedescendant',
    );
  });

  it('moves through the rows with the arrows and wraps at both ends', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveAttribute('aria-label', 'CZK Czech Koruna');

    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toHaveAttribute('aria-label', 'USD US Dollar');

    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toHaveAttribute('aria-label', 'UAH Hryvnia');

    await user.keyboard('{Home}');
    expect(activeOption()).toHaveAttribute('aria-label', 'CZK Czech Koruna');

    await user.keyboard('{End}');
    expect(activeOption()).toHaveAttribute('aria-label', 'USD US Dollar');
  });

  it('points aria-activedescendant at the row the arrows are on', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.keyboard('{ArrowDown}');

    const search = screen.getByPlaceholderText('Search by code or name');
    expect(search).toHaveAttribute('aria-activedescendant', activeOption()?.id);
  });

  it('selects the active row on Enter without submitting anything', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });
    const onChange = vi.fn();
    renderWithProviders(
      <form onSubmit={onSubmit}>
        <Harness onChange={onChange} />
      </form>,
    );

    const trigger = screen.getByRole('combobox', { name: /^From/ });
    await user.click(trigger);
    await user.keyboard('eur{Enter}');

    expect(onChange).toHaveBeenCalledWith('EUR');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent('EUR');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape and puts focus back on the trigger', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const trigger = renderCombobox({ onChange });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('forgets the query between openings', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.keyboard('kr{Escape}');
    await user.click(trigger);

    expect(screen.getByPlaceholderText('Search by code or name')).toHaveValue('');
  });

  it('dims the currency the other pane holds but still lets it be picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const trigger = renderCombobox({ otherValue: 'UAH', onChange });

    await user.click(trigger);
    const hryvnia = within(screen.getByRole('listbox')).getByRole('option', {
      name: 'UAH Hryvnia',
    });
    expect(hryvnia).toHaveAttribute('data-other', 'true');

    await user.click(hryvnia);
    expect(onChange).toHaveBeenCalledWith('UAH');
  });

  it('marks the currency this pane already holds as the selected option', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);

    const selected = options().filter((option) => option.getAttribute('aria-selected') === 'true');
    expect(selected.map((option) => option.getAttribute('aria-label'))).toEqual(['USD US Dollar']);
  });

  it('closes when the pointer lands somewhere else', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <div>
        <Harness />
        <button type="button">Elsewhere</button>
      </div>,
    );

    await user.click(screen.getByRole('combobox', { name: /^From/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('says the list is still loading, and cannot be opened on to nothing', () => {
    const trigger = renderCombobox({ isLoading: true, currencies: [] });

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('Loading list…');
    expect(screen.getByRole('status')).toHaveTextContent('Loading the currency list for From…');
  });

  it('is not changeable while a conversion is in flight, and keeps its chevron', () => {
    const trigger = renderCombobox({ disabled: true });

    expect(trigger).toBeDisabled();
    // The glyph goes fainter, not away: a chevron removed and put back is the
    // trigger changing width under the pointer on every Convert.
    expect(glyph(trigger)).toHaveClass('text-faint');
  });

  it('gives the loading spinner the chevron’s own box', () => {
    const trigger = renderCombobox({ isLoading: true });

    expect(glyph(trigger)).toBeInTheDocument();
    // One class carries the size, so neither state is a different width.
    expect(css).toMatch(/\.combobox-chevron \{\s*height: 0\.75rem;\s*width: 0\.75rem;\s*\}/);
  });

  it('fills its pane at every width rather than shrinking to its name', () => {
    renderCombobox();

    // Board 1o draws From, To and the amount field as one column of equal
    // boxes; a shrink-to-fit trigger made each pane a different width and
    // moved when the currency changed.
    expect(css).toMatch(/\.combobox-trigger \{[^}]*width: 100%;/);
    expect(css).not.toMatch(/\.combobox-trigger \{[^}]*fit-content/);
    // And the name is what gives when there is not room for all of it.
    expect(css).toMatch(/\.combobox-name \{[^}]*text-overflow: ellipsis;/);
  });

  it('wears the field error and points at the sentence that explains it', () => {
    const trigger = renderCombobox({ error: 'from must be an ISO 4217 code' });

    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'from-error');
    expect(document.getElementById('from-error')).toHaveTextContent(
      'from must be an ISO 4217 code',
    );
  });
});

describe('CurrencyCombobox under 640px', () => {
  it('opens the same list as a modal bottom sheet', async () => {
    setCompactViewport(true);
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);

    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet).toHaveAccessibleName('From currency');
    expect(within(sheet).getAllByRole('option')).toHaveLength(CURRENCIES.length);
    expect(within(sheet).getByText('Codes and names')).toBeInTheDocument();
  });

  it('closes on Cancel and hands focus back to the trigger', async () => {
    setCompactViewport(true);
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('clears the search from the field itself', async () => {
    setCompactViewport(true);
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    await user.keyboard('kr');
    expect(within(screen.getByRole('dialog')).getAllByRole('option')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Clear the search' }));

    expect(screen.getByPlaceholderText('Search by code or name')).toHaveValue('');
    expect(within(screen.getByRole('dialog')).getAllByRole('option')).toHaveLength(
      CURRENCIES.length,
    );
  });

  it('keeps Tab inside the sheet', async () => {
    setCompactViewport(true);
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);
    const sheet = screen.getByRole('dialog');

    // Round the whole sheet and back to where it started, never landing on the
    // page behind it.
    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
  });

  it('picks a row from the sheet and closes it', async () => {
    setCompactViewport(true);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const trigger = renderCombobox({ onChange });

    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'GBP Pound Sterling' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith('GBP');
    expect(trigger).toHaveTextContent('GBP');
  });

  it('is a popover again above the breakpoint', async () => {
    const user = userEvent.setup();
    const trigger = renderCombobox();

    await user.click(trigger);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
