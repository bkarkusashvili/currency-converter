export function ExchangeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M8 16h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="8" cy="16" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="24" cy="16" r="3.75" className="fill-accent" />
    </svg>
  );
}
