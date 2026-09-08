import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { Timestamp } from '../Timestamp';

describe('Timestamp', () => {
  it('wraps the value in a time element carrying the machine-readable date', () => {
    renderWithProviders(<Timestamp value="2024-03-05T12:00:00.000Z" />);

    const time = screen.getByText(/2024/);
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', '2024-03-05T12:00:00.000Z');
    expect(time.getAttribute('title')).toContain('2024');
  });

  it('shows a dash when the value is not a date', () => {
    renderWithProviders(<Timestamp value="whenever" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
