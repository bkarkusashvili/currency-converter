import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../components';
import { useFormatters } from '../../../lib';
import { conversionIdentity } from '../lib/conversionIdentity';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { inverseRate } from '../lib/money';

interface ResultDisplayProps {
  outcome: ConversionOutcome | undefined;
  /** A conversion is in flight. Only the first one has nothing to stand in for. */
  isSubmitting: boolean;
}

export const RESULT_LABEL_ID = 'result-label';

/**
 * The output pane's answer slot: the figure, both directions of the rate, and
 * — before the first conversion — the sentence saying what will appear here.
 * Grouped and named so a screen reader reads the number as "Result" rather
 * than as a bare figure between two other panes.
 *
 * The three states are drawn into the same two rows, and `index.css` holds
 * each row open to the tallest of them, so an answer landing — or being
 * replaced by the next one — changes the text and nothing else. Once there is
 * an answer it stays on screen while the next is fetched: the Convert button
 * is what says a conversion is in flight, and the figure is what changes when
 * it lands.
 *
 * That change is what `result-rise` marks: the spans holding the figure and
 * the two rate lines are keyed by `conversionIdentity`, so a new answer
 * remounts the text — and only the text — and replays a 200ms rise of 4px
 * with a slight overshoot. The panes, the rows and the card around them are
 * not keyed and do not move, nothing changes size, and
 * `prefers-reduced-motion` turns the animation off outright.
 */
export function ResultDisplay({ outcome, isSubmitting }: ResultDisplayProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  // Nothing has been converted yet, so there is no figure to hold on to.
  const isPendingFirst = isSubmitting && outcome === undefined;

  return (
    <div role="group" aria-labelledby={RESULT_LABEL_ID} className="grid content-start gap-2">
      <span className="field-label" id={RESULT_LABEL_ID}>
        {t('converter.result.heading')}
      </span>

      <div className="result-figure">
        {isPendingFirst && (
          <div role="status" className="w-full">
            <span className="sr-only">{t('converter.form.submitting')}</span>
            <Skeleton className="h-9 w-[70%]" />
          </div>
        )}

        {/* The dash holds the figure's height open; the sentence below it is
            what says the slot is empty, so the dash is not read out too. */}
        {!isPendingFirst && outcome === undefined && (
          <p aria-hidden="true" className="figure text-line-strong">
            —
          </p>
        )}

        {!isPendingFirst && outcome !== undefined && (
          <p className="figure result-fade-in flex">
            <span
              key={conversionIdentity(outcome)}
              className="result-rise flex items-baseline gap-2 sm:gap-2.5"
            >
              {formatters.money(outcome.result)}{' '}
              <span className="text-muted font-mono text-sm font-medium tracking-[0.08em] sm:text-base">
                {outcome.to}
              </span>
            </span>
          </p>
        )}
      </div>

      <div className="result-detail">
        {isPendingFirst && (
          <div aria-hidden="true" className="grid content-start gap-[3px]">
            <Skeleton className="h-3 w-[55%] rounded-[0.25rem]" />
            <Skeleton className="h-3 w-[45%] rounded-[0.25rem]" />
          </div>
        )}

        {!isPendingFirst && outcome === undefined && (
          <p className="text-faint text-xs text-pretty">{t('converter.result.placeholder')}</p>
        )}

        {!isPendingFirst && outcome !== undefined && <RateLines outcome={outcome} />}
      </div>
    </div>
  );
}

function RateLines({ outcome }: { outcome: ConversionOutcome }) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const rate = formatters.splitRate(outcome.rate);
  // Both directions of the same rate, except when they are the same sentence.
  const inverse = outcome.from === outcome.to ? null : inverseRate(outcome.rate);

  const answer = conversionIdentity(outcome);

  return (
    <div className="numeric result-fade-in grid content-start gap-[3px] font-mono text-xs sm:text-[0.8125rem]">
      <p>
        <span key={answer} className="result-rise block">
          <span className="text-muted">
            {t('converter.result.rateLead', { from: outcome.from })}
          </span>
          {rate.lead}
          <span className="text-faint">{rate.tail}</span>
          <span className="text-muted">{t('converter.result.rateTrail', { to: outcome.to })}</span>
        </span>
      </p>
      {inverse !== null && (
        <p className="text-faint">
          <span key={answer} className="result-rise block">
            {t('converter.result.inverseRate', {
              from: outcome.to,
              rate: formatters.rate(inverse),
              to: outcome.from,
            })}
          </span>
        </p>
      )}
    </div>
  );
}
