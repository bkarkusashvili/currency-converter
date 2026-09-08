import { useTranslation } from 'react-i18next';
import type { ConvertResponse } from '../../../api/types';
import { InfoBadge } from '../../../components/InfoBadge';
import { Timestamp } from '../../../components/Timestamp';
import { useFormatters } from '../../../lib/useFormatters';
import { HUB_CURRENCY, sourceCopy, strategyCopy } from '../lib/provenance';
import { ConversionPath } from './ConversionPath';

export function ConversionResultCard({ result }: { result: ConvertResponse }) {
  const { t } = useTranslation();
  const formatters = useFormatters();

  const strategy = strategyCopy(result.strategy);
  const source = sourceCopy(result.source);
  const rate = formatters.splitRate(result.rate);

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

      <p className="text-muted numeric mt-6 font-mono text-sm">
        {formatters.money(result.amount)} {result.from}
      </p>
      <p className="figure mt-1.5">
        {formatters.money(result.result)}{' '}
        <span className="text-muted text-[0.42em] font-semibold tracking-[0.08em]">
          {result.to}
        </span>
      </p>

      <p className="mt-4 font-mono text-sm">
        <span className="text-muted">{t('converter.result.rateLead', { from: result.from })}</span>
        <span className="numeric text-ink">
          {rate.lead}
          <span className="text-faint">{rate.tail}</span>
        </span>
        <span className="text-muted">{t('converter.result.rateTrail', { to: result.to })}</span>
      </p>

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
                result.source === 'stale-cache' ? 'text-warn font-medium' : 'text-muted',
              ].join(' ')}
            >
              {t(source.noteKey)}
            </dd>
          </div>
        </dl>

        <p className="eyebrow mt-4">
          {t('converter.result.ratesFetched')} <Timestamp value={result.ratesTimestamp} />
        </p>
      </div>
    </section>
  );
}
