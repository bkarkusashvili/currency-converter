export function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-5 grid max-w-2xl gap-2.5">
      {items.map((item) => (
        <li key={item} className="text-muted flex gap-3 text-sm">
          <span aria-hidden="true" className="text-faint">
            ▸
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
