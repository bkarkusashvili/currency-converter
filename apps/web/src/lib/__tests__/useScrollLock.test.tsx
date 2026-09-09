import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useScrollLock } from '../useScrollLock';

function Locked({ active }: { active: boolean }) {
  useScrollLock(active);
  return <div>surface</div>;
}

/** jsdom reports no scrollbar of its own, so the width to compensate is set. */
function setScrollbarWidth(width: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: window.innerWidth - width,
  });
}

afterEach(() => {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  Reflect.deleteProperty(document.documentElement, 'clientWidth');
});

describe('useScrollLock', () => {
  it('leaves the page alone until it is asked not to', () => {
    render(<Locked active={false} />);

    expect(document.body.style.overflow).toBe('');
  });

  it('locks the page and puts back exactly what it found', () => {
    document.body.style.overflow = 'auto';
    const view = render(<Locked active />);

    expect(document.body.style.overflow).toBe('hidden');

    view.unmount();

    expect(document.body.style.overflow).toBe('auto');
  });

  it('pads out the scrollbar it hid, so the page does not jump sideways', () => {
    setScrollbarWidth(15);
    const view = render(<Locked active />);

    expect(document.body.style.paddingRight).toBe('15px');

    view.unmount();

    expect(document.body.style.paddingRight).toBe('');
  });

  it('adds no padding where the scrollbar took no room', () => {
    setScrollbarWidth(0);
    render(<Locked active />);

    expect(document.body.style.paddingRight).toBe('');
  });
});
