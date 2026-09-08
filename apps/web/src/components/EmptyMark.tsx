/** The mark on an empty panel. Decorative: the heading next to it carries the meaning. */
export function EmptyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M5 9.5h22M5 16h22M5 22.5h13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="24.5" cy="22.5" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M24.5 20.5v4M22.5 22.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
