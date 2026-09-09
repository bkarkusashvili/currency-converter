import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSecondsTicker } from '../hooks/useSecondsTicker';

const START = new Date('2026-09-09T12:00:00.000Z').getTime();

function Clock({ until }: { until: number | null }) {
  const now = useSecondsTicker(until);
  return <p>{now - START}</p>;
}

function reading(): number {
  return Number(screen.getByText(/^-?\d+$/).textContent);
}

/** What `document.hidden` answers, which jsdom does not otherwise let you set. */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'hidden');
});

describe('useSecondsTicker', () => {
  it('reads the clock again every second', () => {
    render(<Clock until={START + 60_000} />);

    expect(reading()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(reading()).toBe(3000);
  });

  it('counts nothing when there is nothing to count', () => {
    render(<Clock until={null} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(reading()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops itself at the deadline rather than running for the life of the tab', () => {
    render(<Clock until={START + 2000} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(reading()).toBe(2000);
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(reading()).toBe(2000);
  });

  it('starts nothing when the deadline is already past', () => {
    render(<Clock until={START - 1000} />);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses in a background tab and catches up on the way back', () => {
    render(<Clock until={START + 600_000} />);

    act(() => {
      setHidden(true);
    });
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(reading()).toBe(0);

    act(() => {
      setHidden(false);
    });

    // The first frame back is the current time, not the one from before.
    expect(reading()).toBe(30_000);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('clears its interval when the caller goes away', () => {
    const view = render(<Clock until={START + 600_000} />);

    expect(vi.getTimerCount()).toBe(1);

    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
