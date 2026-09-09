import { useTranslation } from 'react-i18next';
import { useHealth } from '../../../api';
import type { HealthIndicator } from '../../../api';
import { Spinner } from '../../../components';
import { indicatorLabel, livenessUrl, useFormatters } from '../../../lib';
import { breakerState, indicatorReason, type BreakerState } from '../lib/breakerState';

/**
 * `/health` answers `200` when every indicator is up and `503` the moment one
 * is not, and this client accepts both — so the status the card reports is read
 * back off the report rather than off a transport that only surfaces it on a
 * failure (§5.3).
 */
function statusOf(reportStatus: string): number {
  return reportStatus === 'ok' ? 200 : 503;
}

export function HealthCard() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const { data, error, isFetching, dataUpdatedAt, refetch } = useHealth();

  const degraded = data !== undefined && data.status !== 'ok';
  const entries = Object.entries(data?.details ?? {});

  return (
    <section className="ops-card" aria-labelledby="ops-health-title">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ops-card-title" id="ops-health-title">
          <span className="sm:hidden">{t('ops.health.titleShort')}</span>
          <span className="hidden sm:inline">{t('ops.health.title')}</span>
        </h2>
        {data !== undefined && (
          <span
            className={[
              'shrink-0 font-mono text-[0.6875rem] tracking-[0.16em] uppercase',
              degraded ? 'text-danger' : 'text-faint',
            ].join(' ')}
          >
            {t('ops.health.meta', {
              status: statusOf(data.status),
              time: formatters.clock(dataUpdatedAt),
            })}
          </span>
        )}
      </div>

      {error !== null && (
        <div className="grid gap-1">
          <p className="text-danger font-semibold">{t('health.unreachable')}</p>
          <p className="text-faint font-mono text-xs break-words">{error.message}</p>
        </div>
      )}

      {data === undefined && error === null && <p className="text-muted">{t('health.checking')}</p>}

      {data !== undefined && (
        <>
          <p
            className={[
              'text-[1.0625rem] font-semibold tracking-[-0.01em] sm:text-xl sm:tracking-[-0.02em]',
              degraded ? 'text-warn' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {degraded ? t('health.degraded') : t('health.ok')}
          </p>

          <ul className="border-line grid border-t">
            {entries.map(([name, indicator]) => (
              <IndicatorRow key={name} name={name} indicator={indicator} />
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <a
          href={livenessUrl()}
          target="_blank"
          rel="noreferrer"
          className="text-faint hover:text-ink inline-flex min-h-11 items-center font-mono text-[0.6875rem] tracking-[0.12em] whitespace-nowrap uppercase no-underline"
        >
          {t('ops.health.livenessPath')} <span aria-hidden="true">&nbsp;↗</span>
        </a>
        <button
          type="button"
          className="button-flat whitespace-nowrap"
          disabled={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          {isFetching && <Spinner className="mr-2 h-3.5 w-3.5" />}
          {isFetching ? t('ops.health.rechecking') : t('ops.health.recheck')}
        </button>
      </div>
    </section>
  );
}

function IndicatorRow({ name, indicator }: { name: string; indicator: HealthIndicator }) {
  const { t } = useTranslation();
  const up = indicator.status === 'up';
  const breaker = name === 'monobank' ? breakerState(indicator) : null;
  const reason = indicatorReason(indicator);

  return (
    <li className="border-line grid grid-cols-[0.75rem_1fr_auto] items-center gap-3 border-b py-3 sm:grid-cols-[0.75rem_6.875rem_1fr_auto] sm:gap-3.5 sm:py-3.5">
      <span
        aria-hidden="true"
        className={['h-2 w-2 shrink-0 rounded-full', up ? 'bg-accent' : 'bg-danger'].join(' ')}
      />

      <span className="grid gap-0.5 sm:contents">
        <span className="font-mono text-[0.8125rem]">{indicatorLabel(name)}</span>
        <span className="text-muted text-xs sm:text-[0.8125rem]">
          <Description name={name} breaker={breaker} reason={up ? undefined : reason} />
        </span>
      </span>

      <span
        className={[
          'font-mono text-[0.6875rem] tracking-[0.1em] uppercase',
          up ? 'text-muted' : 'text-danger',
        ].join(' ')}
      >
        {up && t('health.statusUp')}
        {indicator.status === 'down' && t('health.statusDown')}
        {!up && indicator.status !== 'down' && indicator.status}
      </span>
    </li>
  );
}

/**
 * What the indicator is for, in this client's own words — the report carries no
 * description (§5.3) — plus the breaker state derived for Monobank, and the
 * sanitised reason a down indicator sent with itself.
 */
function Description({
  name,
  breaker,
  reason,
}: {
  name: string;
  breaker: BreakerState | null;
  reason: string | undefined;
}) {
  const { t } = useTranslation();

  if (name === 'monobank') {
    return (
      <>
        {breaker === null ? (
          t('ops.health.monobankUnknown')
        ) : (
          <>
            {/* The short form beside a stacked name, the long one in the
                four-column row that has space for it. */}
            <span className="sm:hidden">
              <BreakerSentence sentence="ops.health.breaker" state={breaker} />
            </span>
            <span className="hidden sm:inline">
              <BreakerSentence sentence="ops.health.monobank" state={breaker} />
            </span>
          </>
        )}
        {reason !== undefined && breaker === null && ` · ${reason}`}
      </>
    );
  }

  const described = name === 'redis' || name === 'mongodb';

  return (
    <>
      {described && t(`ops.health.${name}`)}
      {reason !== undefined && `${described ? ' · ' : ''}${reason}`}
    </>
  );
}

/**
 * The state name is a different colour from the sentence around it, and the
 * sentence is one translated string with the state interpolated into it. The
 * sentinel is how the two are reconciled: interpolate a character no copy can
 * contain, then split the result on it.
 */
const SENTINEL = '\u0000';

function BreakerSentence({
  sentence,
  state,
}: {
  sentence: 'ops.health.breaker' | 'ops.health.monobank';
  state: BreakerState;
}) {
  const { t } = useTranslation();
  const [lead, tail] = t(sentence, { state: SENTINEL }).split(SENTINEL);

  return (
    <>
      {lead}
      <span
        className={[
          'font-mono text-[0.6875rem] tracking-[0.1em]',
          state === 'CLOSED' ? 'text-ink' : 'text-danger',
        ].join(' ')}
      >
        {state}
      </span>
      {tail}
    </>
  );
}
