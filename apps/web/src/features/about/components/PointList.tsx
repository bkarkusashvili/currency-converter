export interface ContentPoint {
  term: string;
  description: string;
}

export function PointList({ points }: { points: readonly ContentPoint[] }) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2 sm:gap-x-8">
      {points.map((point) => (
        <div key={point.term} className="border-line grid gap-1 border-t pt-3.5">
          <dt className="font-semibold">{point.term}</dt>
          <dd className="text-muted text-sm text-pretty">{point.description}</dd>
        </div>
      ))}
    </dl>
  );
}
