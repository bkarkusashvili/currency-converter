import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrencies, useRatesSnapshot } from '../../../api';
import type { RateSource } from '../../../api';
import { InfoBadge, WarningIcon, type BadgeTone } from '../../../components';
import { useApiErrorMessage, useFormatters } from '../../../lib';
import { durationParts, formatCountdown, snapshotTtl, type SnapshotTtl } from '../lib/snapshotTtl';

interface SnapshotCardProps {
  /** Monobank is refusing calls, so the fallback key is the only thing answering. */
  upstreamDown: boolean;
  /** Nothing has been pasted into the key field, so the command cannot be sent. */
  hasKey: boolean;
  /** The dialog this button opens hands focus back to it when it closes. */
  clearRef: Ref<HTMLButtonElement>;
  onClear: () => void;
}

const SOURCE_VALUE_KEY: Partial<
  Record<
    RateSource,
    | 'converter.source.cache.value'
    | 'converter.source.provider.value'
    | 'converter.source.stale-cache.value'
  >
> = {
  cache: 'converter.source.cache.value',
  provider: 'converter.source.provider.value',
  'stale-cache': 'converter.source.stale-cache.value',
};

/**
 * A neutral chip for the cache, accent for a live provider hit, and warn for
 * anything that may be out of date — including a source this client has not
 * been taught yet, which is the safer way to be wrong about one.
 */
function toneOf(source: RateSource): BadgeTone {
  if (source === 'cache') {
    return 'neutral';
  }

  return source === 'provider' ? 'accent' : 'warn';
}

export function SnapshotCard({ upstreamDown, hasKey, clearRef, onClear }: SnapshotCardProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const messageOf = useApiErrorMessage();
  const { data, error } = useRatesSnapshot();
  const currencies = useCurrencies();

  const durationText = useDurationText();
  const ttl = data === undefined ? null : snapshotTtl(data.fetchedAt);
  // Only when the fallback really is the last thing standing. A derived TTL
  // that has run out is not that: the API is still answering `cache`, and only
  // it knows what its keys are doing.
  const atRisk = data?.source === 'stale-cache' || upstreamDown;
  const count = currencies.data?.currencies.length ?? data?.rates.length;
  const sourceKey = data === undefined ? undefined : SOURCE_VALUE_KEY[data.source];

  return (
    <section className="ops-card" aria-labelledby="ops-snapshot-title">
      <div className="flex items-center justify-between gap-2">
        <h2 className="ops-card-title" id="ops-snapshot-title">
          <span className="sm:hidden">{t('ops.snapshot.titleShort')}</span>
          <span className="hidden sm:inline">{t('ops.snapshot.title')}</span>
        </h2>
        {data !== undefined && (
          <InfoBadge
            label={t('converter.badge.source')}
            // A source this client has no word for is shown exactly as it
            // arrived, which is the rule the converter's badges follow too.
            value={sourceKey === undefined ? data.source : t(sourceKey)}
            tone={toneOf(data.source)}
          />
        )}
      </div>

      {error !== null && (
        <p className="text-danger text-sm text-pretty">
          {t('ops.snapshot.unavailable')} {messageOf(error)}
        </p>
      )}

      {data === undefined && error === null && (
        <p className="text-muted text-sm">{t('ops.snapshot.loading')}</p>
      )}

      {data !== undefined && ttl !== null && (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4">
            <Stat
              label={t('ops.snapshot.fetched')}
              value={formatters.clock(data.fetchedAt)}
              sub={t('ops.snapshot.ago', { duration: durationText(ttl.ageMs) })}
              subTone={ttl.isStale ? 'warn' : 'muted'}
            />
            <Stat
              // Under 640 there is room for two of the three, and the one worth
              // keeping is whichever key is still counting down.
              className={ttl.isStale ? 'max-sm:hidden' : undefined}
              label={t('ops.snapshot.freshExpires')}
              value={
                ttl.isStale ? t('ops.snapshot.expired') : formatCountdown(ttl.freshRemainingMs)
              }
              sub={t('ops.snapshot.ttlFresh')}
              subTone="muted"
            />
            <Stat
              className={ttl.isStale ? undefined : 'max-sm:hidden'}
              label={t('ops.snapshot.fallbackKey')}
              value={formatCountdown(ttl.fallbackRemainingMs)}
              // Once the fresh key is gone this is the only one left, and what
              // matters about it is how much of it there is.
              sub={ttl.isStale ? t('ops.snapshot.ofLeft') : t('ops.snapshot.ttlFallback')}
              subTone="muted"
            />
          </div>

          <Meter ttl={ttl} />

          <p className="text-faint text-xs text-pretty">{t('ops.snapshot.derived')}</p>

          {count !== undefined && (
            <p className="text-muted text-[0.8125rem] text-pretty">
              {t('ops.snapshot.note', { count })}
            </p>
          )}

          {atRisk && (
            <p className="text-warn flex items-start gap-2 text-[0.8125rem] text-pretty">
              <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('ops.clear.staleWarning')}</span>
            </p>
          )}
        </>
      )}

      <div className="border-line flex flex-wrap items-center justify-between gap-4 border-t pt-4 sm:flex-nowrap sm:pt-5">
        <div className="grid gap-0.5">
          <span className="font-semibold">{t('ops.clear.title')}</span>
          <span className="text-muted text-[0.8125rem] text-pretty">
            {t('ops.clear.description')}
          </span>
        </div>

        <button
          type="button"
          ref={clearRef}
          className="button button-danger-outline h-11 shrink-0 px-4 text-sm"
          disabled={!hasKey}
          onClick={onClear}
        >
          {t('ops.clear.button')}
          {!hasKey && (
            <span className="ml-2 font-mono text-[0.625rem] tracking-[0.1em] uppercase">
              {t('ops.clear.noKey')}
            </span>
          )}
        </button>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  subTone,
  className,
}: {
  label: string;
  value: string;
  sub: string;
  subTone: 'muted' | 'warn';
  className?: string;
}) {
  return (
    <div className={['grid gap-0.5 sm:gap-1', className].filter(Boolean).join(' ')}>
      <span className="text-faint font-mono text-[0.6875rem] tracking-[0.12em] uppercase">
        {label}
      </span>
      <span className="ops-stat-value">{value}</span>
      <span className={['text-xs', subTone === 'warn' ? 'text-warn' : 'text-muted'].join(' ')}>
        {sub}
      </span>
    </div>
  );
}

/**
 * How much of a window has been spent — the meter fills as the key ages, which
 * is the direction the boards draw it (42 % on a fresh key three minutes in).
 * Once the fresh key is gone it tracks the fallback instead, in warn.
 */
function Meter({ ttl }: { ttl: SnapshotTtl }) {
  const { t } = useTranslation();
  const fraction = ttl.isStale ? ttl.fallbackElapsed : ttl.freshElapsed;

  return (
    <div
      className="ops-meter"
      role="progressbar"
      aria-label={t('ops.snapshot.progressLabel')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <div
        className={ttl.isStale ? 'bg-warn' : 'bg-accent'}
        style={{ width: `${String(Math.round(fraction * 100))}%` }}
      />
    </div>
  );
}

/** `44 s`, `2 min`, `1 h 27 min` — the shapes the boards write an age in. */
function useDurationText(): (ms: number) => string {
  const { t } = useTranslation();

  return (ms) => {
    const parts = durationParts(ms);

    if (parts.unit === 'seconds') {
      return t('ops.snapshot.durationSeconds', { seconds: parts.seconds });
    }

    return parts.unit === 'minutes'
      ? t('ops.snapshot.durationMinutes', { minutes: parts.minutes })
      : t('ops.snapshot.durationHours', { hours: parts.hours, minutes: parts.minutes });
  };
}
