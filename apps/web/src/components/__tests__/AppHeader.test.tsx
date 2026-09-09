import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AppHeader } from '../AppHeader';

describe('AppHeader', () => {
  it('carries all three pages at every width', () => {
    renderWithProviders(<AppHeader />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveTextContent('Converter');
    expect(nav).toHaveTextContent('About');
    expect(nav).toHaveTextContent('Ops');
  });

  it('keeps the brand named when the wordmark is not drawn', () => {
    renderWithProviders(<AppHeader />);

    const brand = screen.getByRole('link', { name: 'Currency Converter' });
    const wordmark = screen.getByText('Currency Converter');

    // Under 400 the mark is the brand on its own — three nav items, the theme
    // button and a wordmark do not fit a 320 screen, and the wordmark was the
    // thing that truncated. It stays in the accessible tree either way, so the
    // link is named at every width.
    expect(wordmark).toHaveClass('sr-only', 'min-[25rem]:not-sr-only');
    expect(brand).toContainElement(wordmark);
  });
});
