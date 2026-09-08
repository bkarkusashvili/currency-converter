import { useTranslation } from 'react-i18next';
import { useHealth } from '../../../api/hooks/useHealth';

/** Display names only; an indicator the API adds later is shown under its own name. */
const INDICATOR_LABELS: Record<string, string> = {
  redis: 'Redis',
  mongodb: 'MongoDB',
  monobank: 'Monobank',
};

export function HealthStatus() {
  const { t } = useTranslation();
  const { data, error } = useHealth();

  if (error !== null) {
    return (
      <div>
        <p className="text-danger text-sm font-semibold">{t('health.unreachable')}</p>
        <p className="text-faint mt-1 font-mono text-xs">{error.message}</p>
      </div>
    );
  }

  if (data === undefined) {
    return <p className="text-muted text-sm">{t('health.checking')}</p>;
  }

  const degraded = data.status !== 'ok';

  return (
    <div>
      <p className={degraded ? 'text-warn text-sm font-semibold' : 'text-sm'}>
        {degraded ? t('health.degraded') : t('health.ok')}
      </p>
      <ul className="mt-3 grid gap-2">
        {Object.entries(data.details).map(([name, indicator]) => (
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
              {indicator.status === 'up' && t('health.statusUp')}
              {indicator.status === 'down' && t('health.statusDown')}
              {indicator.status !== 'up' && indicator.status !== 'down' && indicator.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
