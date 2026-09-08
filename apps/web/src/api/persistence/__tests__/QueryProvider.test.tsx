import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '../QueryProvider';

function renderProvider() {
  return render(
    <QueryProvider client={new QueryClient()}>
      <p>ready</p>
    </QueryProvider>,
  );
}

describe('QueryProvider', () => {
  it('renders the app on a browser that can persist', async () => {
    renderProvider();

    expect(await screen.findByText('ready')).toBeInTheDocument();
  });

  it('renders the app on a browser that cannot', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('site data is blocked');
    });

    renderProvider();

    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
