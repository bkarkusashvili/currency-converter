import type { MatchRange } from '../lib/currencyFilter';

interface MarkedTextProps {
  text: string;
  /** The stretch the query matched, or nothing to render when the list is unfiltered. */
  match: MatchRange | null;
}

/**
 * The matched stretch in a `<mark>` — the element that means "marked for
 * reference", which is what a search hit is — rather than a styled `<span>`,
 * so the highlight survives a reader that ignores colour.
 */
export function MarkedText({ text, match }: MarkedTextProps) {
  if (match === null) {
    return <>{text}</>;
  }

  return (
    <>
      {text.slice(0, match.start)}
      <mark className="mark-match">{text.slice(match.start, match.end)}</mark>
      {text.slice(match.end)}
    </>
  );
}
