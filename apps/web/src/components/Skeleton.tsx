/** A block standing in for content that has not arrived. Never announced: the panel around it says it is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={['skeleton', className].filter(Boolean).join(' ')} />;
}
