import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { createQueryClient } from '../queryClient';
import { renderWithProviders } from '../test/renderWithProviders';

describe('App', () => {
  it('shows the converter at the root and navigates to the about page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Convert at a rate you can trace.',
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Rates from Monobank');

    await user.click(screen.getByRole('link', { name: 'About' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A currency converter, built as a service.',
    );
  });
});

describe('createQueryClient', () => {
  it('does not refetch on window focus', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});
