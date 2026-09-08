import { useTranslation } from 'react-i18next';
import { InfoBadge } from '../../../components/InfoBadge';
import { Timestamp } from '../../../components/Timestamp';
import { useFormatters } from '../../../lib/useFormatters';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { inverseRate } from '../lib/inverseRate';
import { HUB_CURRENCY, OFFLINE_ESTIMATE, sourceCopy, strategyCopy } from '../lib/provenance';
import { ConversionPath } from './ConversionPath';

export function ConversionResultCard({ result }: { result: ConversionOutcome }) {
  const { t } = useTranslation();
  const formatters = useFormatters();

  const strategy = strategyCopy(result.strategy);
  const source = sourceCopy(result.source);
  const rate = formatters.splitRate(result.rate);
  // Both directions of the same rate, except when they are the same sentence.
  const inverse = result.from === result.to ? null : inverseRate(result.rate);
  // The estimate's note is the only one that has to say how old its rates are,
  // and it is where a reader looks for it: the shared line below would be the
  // same timestamp a second time, so the card carries one or the other.
  const isEstimate = result.source === OFFLINE_ESTIMATE;

  return (
    <section className="card rise-in p-5 sm:p-7" aria-labelledby="result-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="result-heading" className="eyebrow">
          {t('converter.result.heading')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <InfoBadge
            label={t('converter.badge.strategy')}
            value={strategy.valueKey === null ? result.strategy : t(strategy.valueKey)}
            tone={strategy.tone}
          />
          <InfoBadge
            label={t('converter.badge.source')}
            value={source.valueKey === null ? result.source : t(source.valueKey)}
            tone={source.tone}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="text-muted numeric font-mono text-sm">
            {formatters.money(result.amount)} {result.from}
          </p>
          <p className="figure mt-1.5 break-words">
            {formatters.money(result.result)}{' '}
            <span className="text-muted text-[0.42em] font-semibold tracking-[0.08em]">
              {result.to}
            </span>
          </p>
        </div>

        <div className="grid gap-1.5 font-mono text-sm sm:justify-items-end sm:text-right">
          <p>
            <span className="text-muted">
              {t('converter.result.rateLead', { from: result.from })}
            </span>
            <span className="numeric text-ink">
              {rate.lead}
              <span className="text-faint">{rate.tail}</span>
            </span>
            <span className="text-muted">{t('converter.result.rateTrail', { to: result.to })}</span>
          </p>
          {inverse !== null && (
            <p className="text-faint numeric">
              {t('converter.result.inverseRate', {
                from: result.to,
                rate: formatters.rate(inverse),
                to: result.from,
              })}
            </p>
          )}
        </div>
      </div>

      <div className="border-line mt-6 border-t pt-5">
        <ConversionPath from={result.from} to={result.to} strategy={result.strategy} />

        <h3 className="eyebrow mt-5">{t('converter.result.provenanceHeading')}</h3>
        <dl className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold">{t('converter.result.strategyTerm')}</dt>
            <dd className="text-muted mt-1 text-sm">
              {t(strategy.noteKey, { hub: HUB_CURRENCY })}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">{t('converter.result.sourceTerm')}</dt>
            <dd
              className={[
                'mt-1 text-sm',
                source.tone === 'warn' ? 'text-warn font-medium' : 'text-muted',
              ].join(' ')}
            >
              {t(source.noteKey)}
              {isEstimate && (
                <>
                  {' '}
                  <Timestamp value={result.ratesTimestamp} />
                </>
              )}
            </dd>
          </div>
        </dl>

        {!isEstimate && (
          <p className="eyebrow mt-4">
            {t('converter.result.ratesFetched')} <Timestamp value={result.ratesTimestamp} />
          </p>
        )}
      </div>
    </section>
  );
}
