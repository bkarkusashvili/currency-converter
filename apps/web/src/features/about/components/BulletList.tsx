export function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="text-muted grid gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="text-accent shrink-0">
            —
          </span>
          <span className="text-pretty">{item}</span>
        </li>
      ))}
    </ul>
  );
}
