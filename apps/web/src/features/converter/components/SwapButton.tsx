import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The icon turns a half-turn on every press rather than resetting, so the
 * motion always reads as the swap that just happened.
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
      className="border-line-strong text-muted hover:border-accent hover:text-accent hover:bg-accent-soft flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-lg border transition-[color,border-color,background-color] duration-150 sm:mb-[1px] sm:h-[3.125rem] sm:self-auto"
    >
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
    </button>
  );
}
