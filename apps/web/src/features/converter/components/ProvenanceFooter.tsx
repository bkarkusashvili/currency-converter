import { useTranslation } from 'react-i18next';
import { Timestamp, WarningNotes } from '../../../components';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { HUB_CURRENCY, OFFLINE_ESTIMATE, sourceCopy, strategyCopy } from '../lib/provenance';
import { ConversionPath } from './ConversionPath';

/**
 * Where the number came from, across the foot of the card: the hops, when the
 * rates were fetched, then the two sentences naming the strategy and the
 * source. The design drops the "Where this rate came from" sub-heading — the
 * `<dl>` follows the path directly and the terms already say it.
 */
export function ProvenanceFooter({ outcome }: { outcome: ConversionOutcome }) {
  const { t } = useTranslation();
  const strategy = strategyCopy(outcome.strategy);
  const source = sourceCopy(outcome.source);
  // The estimate's note is the only one that has to say how old its rates are,
  // and it is where a reader looks for it: the eyebrow beside the path would
  // be the same timestamp a second time, so the card carries one or the other.
  const isEstimate = outcome.source === OFFLINE_ESTIMATE;

  return (
    <div className="pane-footer border-line grid gap-2.5 px-5 pt-3.5 pb-5 sm:gap-4 sm:border-t sm:px-6 sm:pt-5 sm:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <ConversionPath from={outcome.from} to={outcome.to} strategy={outcome.strategy} />
        {!isEstimate && (
          <p
            className={[
              'eyebrow text-[0.625rem] tracking-[0.14em] sm:text-[0.6875rem] sm:tracking-[0.16em]',
              source.tone === 'warn' ? 'text-warn' : '',
            ].join(' ')}
          >
            {/* Board 1i shortens this line to "Fetched 14:32" on a phone.
                Exactly one of the two is `display: none` at any width, so one
                of them is in the accessibility tree and the other is not. */}
            <Timestamp
              className="sm:hidden"
              value={outcome.ratesTimestamp}
              sentenceKey="converter.result.ratesFetchedShort"
            />
            <span className="hidden sm:inline">
              {t('converter.result.ratesFetched')}{' '}
              <Timestamp value={outcome.ratesTimestamp} withPreposition />
            </span>
          </p>
        )}
      </div>

      <dl className="grid gap-2.5 sm:grid-cols-2 sm:gap-6">
        <div className="grid gap-0.5 sm:gap-1">
          <dt className="text-[0.8125rem] font-semibold sm:text-sm">
            {t('converter.result.strategyTerm')}
          </dt>
          <dd className="text-muted text-[0.8125rem] text-pretty sm:text-sm">
            {t(strategy.noteKey, { hub: HUB_CURRENCY })}
          </dd>
        </div>
        <div className="grid gap-0.5 sm:gap-1">
          <dt className="text-[0.8125rem] font-semibold sm:text-sm">
            {t('converter.result.sourceTerm')}
          </dt>
          <dd
            className={[
              'text-[0.8125rem] text-pretty sm:text-sm',
              source.tone === 'warn' ? 'text-warn font-medium' : 'text-muted',
            ].join(' ')}
          >
            {t(source.noteKey)}
            {isEstimate && (
              <>
                {' '}
                <Timestamp value={outcome.ratesTimestamp} withPreposition />
              </>
            )}
          </dd>
        </div>
      </dl>

      {/* What degraded while this answer was produced (§3). The answer above
          still stands; this is what it cost. */}
      <WarningNotes warnings={outcome.warnings} />
    </div>
  );
}
