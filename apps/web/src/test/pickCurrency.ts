import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

/**
 * What every suite that used `selectOptions` on the old native select does now:
 * open the picker the pane's eyebrow names, and click a row in the list it
 * opens. The two currency pickers are told apart by that eyebrow — `From` or
 * `To` — which is the label the design gives them.
 */
export async function openPicker(user: UserEvent, field: string): Promise<HTMLElement> {
  const trigger = await screen.findByRole('combobox', { name: new RegExp(`^${field}\\b`) });
  await waitFor(() => {
    expect(trigger).toBeEnabled();
  });
  await user.click(trigger);

  return screen.findByRole('listbox', { name: field });
}

export async function pickCurrency(user: UserEvent, field: string, code: string): Promise<void> {
  const listbox = await openPicker(user, field);
  await user.click(within(listbox).getByRole('option', { name: new RegExp(`^${code}\\b`) }));
}

/** The codes a picker is offering, in the order it offers them. */
export function listedCurrencies(listbox: HTMLElement): string[] {
  return within(listbox)
    .getAllByRole('option')
    .map((option) => option.getAttribute('aria-label') ?? '');
}
