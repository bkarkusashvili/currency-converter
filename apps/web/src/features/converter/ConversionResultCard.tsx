import { InfoBadge } from '../../components/InfoBadge';
import type { ConvertResponse } from '../../api/types';
import { formatMoney, formatRate, formatTime, splitRate } from '../../lib/format';
import { ConversionPath } from './ConversionPath';
import { SOURCE_COPY, STRATEGY_COPY } from './provenance';

export function ConversionResultCard({ result }: { result: ConvertResponse }) {
  const strategy = STRATEGY_COPY[result.strategy];
  const source = SOURCE_COPY[result.source];
  const rate = splitRate(result.rate);

  return (
    <section className="card rise-in p-5 sm:p-7" aria-labelledby="result-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="result-heading" className="eyebrow">
          Result
        </h2>
        <div className="flex flex-wrap gap-2">
          <InfoBadge
            label="strategy"
            value={strategy.value}
            description={strategy.tooltip}
            tone={strategy.tone}
          />
          <InfoBadge
            label="source"
            value={source.value}
            description={source.tooltip}
            tone={source.tone}
          />
        </div>
      </div>

      <p className="text-muted numeric mt-6 font-mono text-sm">
        {formatMoney(result.amount)} {result.from}
      </p>
      <p className="figure mt-1.5">
        {formatMoney(result.result)}{' '}
        <span className="text-muted text-[0.42em] font-semibold tracking-[0.08em]">
          {result.to}
        </span>
      </p>

      <p
        className="mt-4 font-mono text-sm"
        aria-label={`1 ${result.from} equals ${formatRate(result.rate)} ${result.to}`}
      >
        <span className="text-muted">1 {result.from} = </span>
        <span className="numeric text-ink">
          {rate.lead}
          <span className="text-faint">{rate.tail}</span>
        </span>
        <span className="text-muted"> {result.to}</span>
      </p>

      <div className="border-line mt-6 border-t pt-5">
        <ConversionPath from={result.from} to={result.to} strategy={result.strategy} />
        <p className="text-muted mt-4 text-sm">{strategy.note}</p>
        <p
          className={[
            'mt-1.5 text-sm',
            result.source === 'stale-cache' ? 'text-warn font-medium' : 'text-faint',
          ].join(' ')}
        >
          {source.note}
        </p>
        <p className="eyebrow mt-4">Rates fetched {formatTime(result.ratesTimestamp)}</p>
      </div>
    </section>
  );
}
