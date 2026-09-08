export interface ContentPoint {
  term: string;
  description: string;
}

export function PointList({ points }: { points: readonly ContentPoint[] }) {
  return (
    <dl className="mt-5 grid gap-6 sm:grid-cols-2">
      {points.map((point) => (
        <div key={point.term}>
          <dt className="font-semibold">{point.term}</dt>
          <dd className="text-muted mt-1.5 text-sm">{point.description}</dd>
        </div>
      ))}
    </dl>
  );
}
