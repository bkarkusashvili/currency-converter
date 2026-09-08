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

  it('takes the preposition a date needs and a relative day does not', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { rerender } = renderWithProviders(
      <Timestamp value="2024-03-05T12:00:00.000Z" withPreposition />,
    );
    expect(screen.getByText(/^on .*2024/)).toBeInTheDocument();

    rerender(<Timestamp value={yesterday.toISOString()} withPreposition />);
    expect(screen.getByText('yesterday')).toBeInTheDocument();

    rerender(<Timestamp value={new Date().toISOString()} withPreposition />);
    expect(screen.getByText(/^at \d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it('shows a dash when the value is not a date', () => {
    renderWithProviders(<Timestamp value="whenever" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
