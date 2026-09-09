import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../../lib';
import { shortenRequestId, type SessionAction } from '../lib/sessionActions';

const OUTCOME_KEY = {
  cleared: 'ops.actions.cleared',
  unauthorized: 'ops.actions.unauthorized',
  failed: 'ops.actions.failed',
} as const;

/**
 * What this page has sent since it was opened, and nothing more: there is no
 * route that reports past invalidations, and the eyebrow promises as much
 * rather than implying a record that does not exist (§6.20).
 */
export function SessionActionLog({ actions }: { actions: readonly SessionAction[] }) {
  const { t } = useTranslation();
  const formatters = useFormatters();

  return (
    <section aria-labelledby="ops-actions-title" className="grid">
      <div className="border-line flex items-baseline justify-between gap-3 border-b pb-3">
        <h2 id="ops-actions-title" className="text-base">
          {t('ops.actions.title')}
        </h2>
        <span className="eyebrow">{t('ops.actions.notPersisted')}</span>
      </div>

      {actions.length === 0 ? (
        <p className="text-muted py-3 text-sm">{t('ops.actions.empty')}</p>
      ) : (
        <ul className="grid">
          {actions.map((action) => (
            <li
              key={action.id}
              className="border-line grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 border-b py-3 font-mono text-[0.8125rem] sm:grid-cols-[5rem_1fr_auto_auto] sm:gap-6"
            >
              <span className="text-faint">{formatters.clock(action.at)}</span>
              <span className="break-words">
                {action.method} {action.path}
              </span>
              <span className="text-faint col-start-2 text-xs sm:col-start-auto">
                {action.requestId === undefined
                  ? ''
                  : t('errors.requestId', { id: shortenRequestId(action.requestId) })}
              </span>
              <span
                className={[
                  'col-start-2 text-[0.6875rem] tracking-[0.1em] uppercase sm:col-start-auto',
                  action.outcome === 'cleared' ? 'text-accent' : 'text-danger',
                ].join(' ')}
              >
                {t(OUTCOME_KEY[action.outcome], { status: action.status })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
