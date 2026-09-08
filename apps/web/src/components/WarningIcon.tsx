/** The mark on an error notice. Decorative: the notice's text is the message. */
export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className={className}>
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 5.75v5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}
