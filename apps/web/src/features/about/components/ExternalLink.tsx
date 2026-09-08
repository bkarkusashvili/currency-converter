interface ExternalLinkProps {
  href: string;
  label: string;
  hint?: string;
}

/**
 * `min-h-11` is 44 px: these are the only links on the page a reviewer is
 * expected to tap, and the converter's controls are already held to that.
 */
export function ExternalLink({ href, label, hint }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex min-h-11 flex-col justify-center"
    >
      <span className="group-hover:text-accent font-semibold underline decoration-transparent underline-offset-4 transition group-hover:decoration-current">
        {label} <span aria-hidden="true">↗</span>
      </span>
      {hint !== undefined && <span className="text-faint font-mono text-xs">{hint}</span>}
    </a>
  );
}
