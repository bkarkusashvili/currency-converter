import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRateHistory } from '../../../api';
import type { ApiError } from '../../../api';
import { EmptyMark, Skeleton, WarningIcon } from '../../../components';
import { useApiErrorMessage, useFormatters } from '../../../lib';
import { HUB_CURRENCY } from '../lib/provenance';
import { DEFAULT_RANGE, type RangeDays } from '../lib/rateHistoryRange';
import { buildRateHistorySeries, type RateHistorySeries } from '../lib/rateHistorySeries';
import { RangeControl } from './RangeControl';
import { RateHistoryChart } from './RateHistoryChart';
import { RateHistoryTable } from './RateHistoryTable';

const HEADING_ID = 'rate-history-heading';
const SUMMARY_ID = 'rate-history-summary';
const BODY_ID = 'rate-history-body';

/**
 * The pair has no archived day rather than the archive being unreadable. The
 * API draws that line at 422 — `UNSUPPORTED_CURRENCY` when neither side of the
 * pair appears in the window at all, `RATE_NOT_AVAILABLE` when both do but
 * this orientation was never published — and both mean the same thing to a
 * reader: there is nothing to chart yet. A red failure notice would say the
 * opposite (§3.21, §6.7).
 */
const NO_SERIES_STATUS = 422;
const NO_SERIES_CODES: readonly string[] = ['UNSUPPORTED_CURRENCY', 'RATE_NOT_AVAILABLE'];

function isMissingSeries(error: ApiError): boolean {
  return error.statusCode === NO_SERIES_STATUS && NO_SERIES_CODES.includes(error.code);
}

interface RateHistoryPanelProps {
  /** The pair the form is on, which this follows — including through a swap. */
  base: string;
  quote: string;
}

/**
 * The week behind the rate: one point per archived day for the selected pair,
 * as a chart and as a table, over 7, 30 or 90 days.
 *
 * It reads its own query and owns its own failure. Nothing here can stop a
 * conversion: Convert is in the card above and never waits on this, so an
 * archive that is down costs the reader a chart and not an answer.
 *
 * Collapsed by default under 640, where the panel is taller than the card it
 * explains; above that it is always open, which is why the toggle is a
 * `sm:hidden` button and the body is `hidden sm:grid` rather than unmounted.
 */
export function RateHistoryPanel({ base, quote }: RateHistoryPanelProps) {
  const { t } = useTranslation();
  const messageOf = useApiErrorMessage();
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const query = useRateHistory({ base, quote, days });

  // A day called out and a table opened to its full height both belong to the
  // series that was on screen. A different pair or a different window is a
  // different series, and carrying either across would leave the seventh row
  // of a week shaded because the reader had hovered day 7 of a quarter. Reset
  // while rendering rather than in an effect: this is state derived from a
  // change of props, and an effect would paint the stale one first.
  const identity = `${base}/${quote}/${String(days)}`;
  const [shown, setShown] = useState(identity);

  if (shown !== identity) {
    setShown(identity);
    setActiveIndex(null);
    setShowAll(false);
  }
  const series = query.data === undefined ? null : buildRateHistorySeries(query.data.points);
  const pair = t('rateHistory.pair', { base, quote });
  /**
   * When this pair and window were last on screen, which is the only thing a
   * failure has to report — and the query itself is the record of it: a key
   * that has never resolved has no `dataUpdatedAt`, so there is nothing to
   * remember separately and nothing to keep in step with the pair.
   */
  const lastShown =
    query.dataUpdatedAt > 0 ? { days, at: new Date(query.dataUpdatedAt).toISOString() } : null;

  const missing = query.error !== null && isMissingSeries(query.error);
  const isEmpty = missing || (query.data !== undefined && series === null);
  const failed = query.error !== null && !missing;

  return (
    <section
      aria-labelledby={HEADING_ID}
      className={[
        'card grid sm:content-start sm:gap-5 sm:p-6',
        open ? 'gap-4 p-5' : 'h-14 content-center px-5 sm:h-auto sm:px-6',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-px sm:gap-0.5">
          <h2 id={HEADING_ID} className="text-[0.9375rem] sm:text-base">
            {t('rateHistory.heading')}{' '}
            <span className="font-mono text-sm font-semibold sm:text-[0.9375rem]">· {pair}</span>
          </h2>
          <Summary
            id={SUMMARY_ID}
            series={series}
            days={days}
            isPending={query.isPending}
            isEmpty={isEmpty}
            failed={failed}
            lastShown={lastShown}
          />
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls={BODY_ID}
          className="text-muted -mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center sm:hidden"
          onClick={() => {
            setOpen(!open);
          }}
        >
          <span className="sr-only">{t(open ? 'rateHistory.collapse' : 'rateHistory.expand')}</span>
          <Chevron className={open ? 'h-3.5 w-3.5 rotate-180' : 'h-3.5 w-3.5'} />
        </button>

        <div className={open ? 'w-full sm:w-auto' : 'hidden sm:block'}>
          <RangeControl value={days} dimmed={query.isPending || isEmpty} onChange={setDays} />
        </div>
      </div>

      <div
        id={BODY_ID}
        className={`history-body ${open ? 'grid gap-4' : 'hidden sm:grid sm:gap-5'}`}
      >
        {query.isPending && <PanelSkeleton />}

        {failed && query.error !== null && (
          <div className="grid gap-3">
            <div className="text-muted flex items-start gap-2.5 py-5 text-sm sm:py-6">
              <WarningIcon className="text-warn mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {t('rateHistory.unavailable')}
                {/* The envelope read the way every other failure reads it, so
                    the archive's own 503 explains itself (§6.7). */}
                <span className="text-faint mt-1 block text-xs">{messageOf(query.error)}</span>
              </span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="border-line-strong h-11 rounded-[0.625rem] border px-4 text-sm font-semibold"
                onClick={() => {
                  void query.refetch();
                }}
              >
                {t('common.tryAgain')}
              </button>
            </div>
          </div>
        )}

        {isEmpty && <PanelEmpty />}

        {/* A failed refetch keeps the answer it had, but the panel does not
            keep drawing it: the summary says when it was last shown and the
            note above says why it is not being redrawn. */}
        {!failed && series !== null && (
          <div className="history-layout">
            <div className="grid gap-2.5">
              <RateHistoryChart
                series={series}
                days={days}
                activeIndex={activeIndex}
                onActivate={setActiveIndex}
                describedBy={SUMMARY_ID}
              />
              {series.kind === 'spread' && <Legend />}
            </div>
            <RateHistoryTable
              series={series}
              base={base}
              quote={quote}
              activeIndex={activeIndex}
              onActivate={setActiveIndex}
              showAll={showAll}
              onShowAll={() => {
                setShowAll(true);
              }}
            />
          </div>
        )}

        <p className="eyebrow tracking-[0.12em]">
          {query.isPending ? t('rateHistory.loading') : t('rateHistory.footnote')}
        </p>
      </div>
    </section>
  );
}

interface SummaryProps {
  id: string;
  series: RateHistorySeries | null;
  /** The window that was asked for, which the sentence names. */
  days: number;
  isPending: boolean;
  isEmpty: boolean;
  failed: boolean;
  /** When this pair and window were last on screen, which is all a failure can report. */
  lastShown: { days: number; at: string } | null;
}

/** The change over the window and what the two lines are — or what stands in for it. */
function Summary({ id, series, days, isPending, isEmpty, failed, lastShown }: SummaryProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const line = 'text-muted text-xs sm:text-[0.8125rem]';
  const stamp = lastShown === null ? null : formatters.timestamp(lastShown.at);

  if (isPending) {
    return <Skeleton className="mt-1 h-3 w-[9.375rem] rounded-[0.25rem]" />;
  }

  if (isEmpty) {
    return (
      <p id={id} className={line}>
        {t('rateHistory.emptySummary')}
      </p>
    );
  }

  if (failed) {
    // Nothing was ever shown for this pair, so there is nothing to say it was
    // last shown at; the note in the body says what happened instead.
    return stamp === null || lastShown === null ? null : (
      <p id={id} className={line}>
        {t('rateHistory.lastShown', { days: lastShown.days, time: stamp.text })}
      </p>
    );
  }

  if (series === null) {
    return null;
  }

  const change = t(CHANGE_KEY[series.change.direction], {
    percent: formatters.percent(series.change.magnitude),
    days,
  });
  // The spread tail says where the buy rate started and where it ended, which
  // on a series that did not move is `buy 44.35 → 44.35`: the same number
  // twice, offered as the detail behind the word `Unchanged`. The cross tail
  // says what the line *is* rather than how it moved, so it stays.
  const detail =
    series.kind === 'spread'
      ? series.change.direction === 'flat'
        ? null
        : t('rateHistory.detailSpread', {
            first: formatters.rate(series.change.first),
            last: formatters.rate(series.change.last),
          })
      : t('rateHistory.detailCross', { hub: HUB_CURRENCY });

  return (
    <p id={id} className={line}>
      {change}
      {/* What the two lines are. Under 640 there is room for the move and
          nothing else, which is what boards 3c and 3d show — and the tail is
          dropped rather than written twice, because this line is also what
          describes the chart. */}
      {detail !== null && (
        <>
          {' '}
          <span className="hidden sm:inline">{t('rateHistory.summaryTail', { detail })}</span>
        </>
      )}
    </p>
  );
}

const CHANGE_KEY = {
  up: 'rateHistory.changeUp',
  down: 'rateHistory.changeDown',
  flat: 'rateHistory.changeFlat',
} as const;

function Legend() {
  const { t } = useTranslation();

  return (
    <div className="text-muted flex gap-4 font-mono text-[0.6875rem] tracking-[0.06em]">
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-accent h-0.5 w-3.5 rounded-[1px]" />
        {t('rateHistory.legend.buy')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-muted h-0.5 w-3.5 rounded-[1px]" />
        {t('rateHistory.legend.sell')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-accent-soft h-2 w-3.5 rounded-[2px]" />
        {t('rateHistory.legend.spread')}
      </span>
    </div>
  );
}

const SKELETON_BARS = ['w-[90%]', 'w-[80%]', 'w-[85%]'];

function PanelSkeleton() {
  return (
    <div role="status" className="grid gap-3">
      <Skeleton className="h-[8.75rem] rounded-lg" />
      {SKELETON_BARS.map((width) => (
        <Skeleton key={width} className={`h-3 rounded-[0.25rem] ${width}`} />
      ))}
    </div>
  );
}

function PanelEmpty() {
  const { t } = useTranslation();

  return (
    <div className="border-line grid justify-items-center gap-1.5 rounded-[0.625rem] border border-dashed px-4 py-10 text-center">
      <EmptyMark className="text-faint h-8 w-8" />
      <p className="mt-2.5 font-semibold">{t('rateHistory.emptyHeading')}</p>
      <p className="text-muted max-w-[16.25rem] text-sm text-pretty">{t('rateHistory.empty')}</p>
    </div>
  );
}

/** The same chevron the currency trigger wears, rotated when the panel is open. */
function Chevron({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
