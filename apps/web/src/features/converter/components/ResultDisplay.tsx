import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../components';
import { useFormatters } from '../../../lib';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { inverseRate } from '../lib/money';

interface ResultDisplayProps {
  outcome: ConversionOutcome | undefined;
  /** A conversion is in flight, so the pane stands in for the answer it is about to hold. */
  isSubmitting: boolean;
}

export const RESULT_LABEL_ID = 'result-label';

/**
 * The output pane's answer slot: the figure, both directions of the rate, and
 * — before the first conversion — the sentence saying what will appear here.
 * Grouped and named so a screen reader reads the number as "Result" rather
 * than as a bare figure between two other panes.
 */
export function ResultDisplay({ outcome, isSubmitting }: ResultDisplayProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();

  return (
    <div
      role="group"
      aria-labelledby={RESULT_LABEL_ID}
      className={['grid gap-2', outcome === undefined ? '' : 'rise-in'].join(' ').trim()}
    >
      <span className="field-label" id={RESULT_LABEL_ID}>
        {t('converter.result.heading')}
      </span>

      {isSubmitting && <ResultSkeleton />}

      {!isSubmitting && outcome === undefined && (
        <>
          <p className="figure text-line-strong flex items-center sm:h-16">—</p>
          <p className="text-faint text-xs text-pretty">{t('converter.result.placeholder')}</p>
        </>
      )}

      {!isSubmitting && outcome !== undefined && (
        <>
          <p className="figure flex items-baseline gap-2 sm:h-16 sm:gap-2.5">
            {formatters.money(outcome.result)}{' '}
            <span className="text-muted font-mono text-sm font-medium tracking-[0.08em] sm:text-base">
              {outcome.to}
            </span>
          </p>
          <RateLines outcome={outcome} />
        </>
      )}
    </div>
  );
}

function RateLines({ outcome }: { outcome: ConversionOutcome }) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const rate = formatters.splitRate(outcome.rate);
  // Both directions of the same rate, except when they are the same sentence.
  const inverse = outcome.from === outcome.to ? null : inverseRate(outcome.rate);

  return (
    <div className="numeric grid gap-[3px] font-mono text-xs sm:text-[0.8125rem]">
      <p>
        <span className="text-muted">{t('converter.result.rateLead', { from: outcome.from })}</span>
        {rate.lead}
        <span className="text-faint">{rate.tail}</span>
        <span className="text-muted">{t('converter.result.rateTrail', { to: outcome.to })}</span>
      </p>
      {inverse !== null && (
        <p className="text-faint">
          {t('converter.result.inverseRate', {
            from: outcome.to,
            rate: formatters.rate(inverse),
            to: outcome.from,
          })}
        </p>
      )}
    </div>
  );
}

/** The same `sunken + 1px line` fill every other skeleton uses (§6.6). */
function ResultSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" className="grid gap-2.5">
      <span className="sr-only">{t('converter.form.submitting')}</span>
      <Skeleton className="h-9 w-[70%]" />
      <Skeleton className="h-3 w-[55%] rounded-[0.25rem]" />
      <Skeleton className="h-3 w-[45%] rounded-[0.25rem]" />
    </div>
  );
}
