import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useFocusTrap } from '../useFocusTrap';

/** A trapped surface, with or without anything in it to trap. */
function Surface({ empty = false }: { empty?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);

  return (
    <div ref={ref}>
      {!empty && (
        <>
          <button type="button">first</button>
          <button type="button">last</button>
        </>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('wraps Shift+Tab from the first control round to the last', async () => {
    const user = userEvent.setup();
    render(<Surface />);

    screen.getByRole('button', { name: 'first' }).focus();
    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
  });

  it('steps aside when the surface holds nothing to focus', async () => {
    const user = userEvent.setup();
    render(<Surface empty />);

    // Nothing to hold on to and nothing to throw: a trap around an empty
    // surface reads past neither end of the list.
    await user.tab();

    expect(document.body).toHaveFocus();
  });
});
