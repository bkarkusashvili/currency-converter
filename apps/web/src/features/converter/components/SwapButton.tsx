import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The control on the seam between the two panes. The icon turns a half-turn on
 * every press rather than resetting, so the motion always reads as the swap
 * that just happened; the 90° above 640 is the layout's, not the press's —
 * side by side the arrows point left and right, stacked they point up and down.
 */
export function SwapButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const [turns, setTurns] = useState(0);

  return (
    <button
      type="button"
      onClick={() => {
        setTurns((count) => count + 1);
        onClick();
      }}
      aria-label={t('converter.form.swap')}
      className="swap-button absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      <span className="flex sm:rotate-90">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="swap-icon h-4 w-4"
          style={{ transform: `rotate(${String(turns * 180)}deg)` }}
        >
          <path
            d="M7 4v13m0 0-3-3m3 3 3-3M17 20V7m0 0-3 3m3-3 3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
