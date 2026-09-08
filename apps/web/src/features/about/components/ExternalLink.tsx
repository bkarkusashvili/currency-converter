interface ExternalLinkProps {
  href: string;
  label: string;
  hint?: string;
}

export function ExternalLink({ href, label, hint }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group inline-flex flex-col">
      <span className="group-hover:text-accent font-semibold underline decoration-transparent underline-offset-4 transition group-hover:decoration-current">
        {label} <span aria-hidden="true">↗</span>
      </span>
      {hint !== undefined && <span className="text-faint font-mono text-xs">{hint}</span>}
    </a>
  );
}
