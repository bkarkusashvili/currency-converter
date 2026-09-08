import type { HealthIndicator } from '../../api/types';
import { useHealth } from '../../api/useHealth';

const INDICATOR_LABELS: Record<string, string> = {
  redis: 'Redis',
  mongodb: 'MongoDB',
  monobank: 'Monobank',
};

export function HealthStatus() {
  const { data, error } = useHealth();

  if (error !== null) {
    return (
      <div>
        <p className="text-danger text-sm font-semibold">The health endpoint did not answer.</p>
        <p className="text-faint mt-1 font-mono text-xs">{error.message}</p>
      </div>
    );
  }

  if (data === undefined) {
    return <p className="text-muted text-sm">Checking the API…</p>;
  }

  const indicators = Object.keys(INDICATOR_LABELS)
    .map((name) => ({ name, indicator: data.details[name] }))
    .filter(
      (entry): entry is { name: string; indicator: HealthIndicator } =>
        entry.indicator !== undefined,
    );

  return (
    <div>
      <p className="text-sm">
        API reports <span className="font-semibold">{data.status}</span>
      </p>
      <ul className="mt-3 grid gap-2">
        {indicators.map(({ name, indicator }) => (
          <li key={name} className="flex items-center gap-2.5 font-mono text-xs">
            <span
              aria-hidden="true"
              className={[
                'h-2 w-2 shrink-0 rounded-full',
                indicator.status === 'up' ? 'bg-accent' : 'bg-danger',
              ].join(' ')}
            />
            <span className="text-muted w-20">{INDICATOR_LABELS[name] ?? name}</span>
            <span className={indicator.status === 'up' ? 'text-muted' : 'text-danger'}>
              {indicator.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
