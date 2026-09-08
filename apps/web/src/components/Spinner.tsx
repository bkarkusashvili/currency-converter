/**
 * The pending mark on a button. `aria-hidden` because the button's label
 * already says it is converting, and `aria-busy` says it to assistive tech.
 * The whole element rotates, so the arc turns around the circle's centre.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={['spinner', className].filter(Boolean).join(' ')}
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
