import { useTranslation } from 'react-i18next';
import { useHealth } from '../../../api';

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
      <div className="grid gap-1">
        <p className="text-danger text-sm font-semibold">{t('health.unreachable')}</p>
        <p className="text-faint font-mono text-xs break-words">{error.message}</p>
      </div>
    );
  }

  if (data === undefined) {
    return <p className="text-muted text-sm">{t('health.checking')}</p>;
  }

  const degraded = data.status !== 'ok';

  return (
    <div className="grid gap-3">
      <p className={degraded ? 'text-warn text-sm font-semibold' : 'text-sm font-semibold'}>
        {degraded ? t('health.degraded') : t('health.ok')}
      </p>
      <ul className="grid gap-2 font-mono text-xs">
        {Object.entries(data.details).map(([name, indicator]) => (
          <li key={name} className="flex items-center gap-2.5">
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
      {/* The interval `useHealth` actually polls on, said once rather than
          implied by numbers that change on their own. */}
      <p className="text-faint font-mono text-[0.625rem] tracking-[0.1em] uppercase">
        {t('health.rechecked')}
      </p>
    </div>
  );
}
