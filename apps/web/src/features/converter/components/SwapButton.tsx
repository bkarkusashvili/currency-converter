import { useTranslation } from 'react-i18next';

export function SwapButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('converter.form.swap')}
      className="border-line-strong text-muted hover:border-accent hover:text-accent flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-lg border transition-colors sm:mb-[1px] sm:h-[3.125rem] sm:self-auto"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
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
