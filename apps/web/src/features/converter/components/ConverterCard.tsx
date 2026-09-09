import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiError, ConvertRequest, Currency, ResponseWarning } from '../../../api';
import { Spinner, WarningNotes } from '../../../components';
import { useApiErrorMessage, useFormatters } from '../../../lib';
import { useConverterForm } from '../hooks/useConverterForm';
import type { ConversionOutcome } from '../lib/conversionOutcome';
import { currencyOptions } from '../lib/currencyOptions';
import { conversionKey } from '../lib/historyHighlight';
import { MAX_FRACTION_DIGITS, MAX_INTEGER_DIGITS } from '../lib/amount/formatAmountInput';
import type { FormFieldErrors } from '../lib/serverFieldErrors';
import { AmountField } from './AmountField';
import { CurrencySelect } from './CurrencySelect';
import { ProvenanceFooter } from './ProvenanceFooter';
import { ResultBadges } from './ResultBadges';
import { ResultDisplay } from './ResultDisplay';
import { SwapButton } from './SwapButton';

interface ConverterCardProps {
  /** Undefined until the list loads, and after a failure that no persisted copy answered. */
  currencies: Currency[] | undefined;
  currenciesError: ApiError | null;
  /** No list has arrived and none was stored, so the selects have nothing to offer yet. */
  currenciesLoading: boolean;
  /** What degraded while the lists behind this form were fetched (§3); usually nothing. */
  warnings: ResponseWarning[];
  serverErrors: FormFieldErrors;
  isSubmitting: boolean;
  /** The answer, which the output pane holds until the next one replaces it. */
  outcome: ConversionOutcome | undefined;
  onSubmit: (request: ConvertRequest) => void;
}

/**
 * What you give and what you get, in one card: the input pane on the left, the
 * output pane on the right, and the swap control on the seam between them.
 * Under 640 the same four blocks stack — input, seam, output, action — and
 * Convert moves out of the input pane into the card's own footer, so the
 * thumb reaches it after reading both halves rather than between them.
 *
 * Everything is one `<form>`: the result is not a second card that appears
 * below, it is the pane that was already there filling in.
 */
export function ConverterCard({
  currencies,
  currenciesError,
  currenciesLoading,
  warnings,
  serverErrors,
  isSubmitting,
  outcome,
  onSubmit,
}: ConverterCardProps) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const messageOf = useApiErrorMessage();
  const amountRef = useRef<HTMLInputElement>(null);
  const form = useConverterForm({
    serverErrors,
    onSubmit,
    onAmountInvalid: () => amountRef.current?.focus(),
  });
  const options = currencyOptions(currencies);
  // A failed request whose persisted copy is answering is a different sentence
  // from one that left the form with nothing but its defaults.
  const hintKey =
    currencies === undefined || currencies.length === 0
      ? 'converter.form.currenciesUnavailable'
      : 'converter.form.currenciesFromCache';

  return (
    <form className="card converter-card" onSubmit={form.handleSubmit} noValidate>
      <div className="pane-input grid content-start gap-3 p-5 pb-6 sm:gap-3.5 sm:p-6 sm:pb-0">
        <CurrencySelect
          id="from"
          label={t('converter.form.from')}
          value={form.from}
          currencies={options}
          isLoading={currenciesLoading}
          error={form.errors.from}
          onChange={form.setFrom}
        />

        <AmountField
          id="amount"
          label={t('converter.form.amount')}
          // The two caps the field actually enforces. What an amount may *be*
          // is parseAmount's rule, and it says so in its own message when it
          // has to.
          hint={t('converter.form.amountHint', {
            digits: MAX_INTEGER_DIGITS,
            decimals: MAX_FRACTION_DIGITS,
          })}
          value={form.amount}
          error={form.errors.amount}
          separators={formatters.separators}
          inputRef={amountRef}
          onChange={form.setAmount}
        />

        {currenciesError !== null && (
          <p className="text-muted text-[0.8125rem] text-pretty">
            {t(hintKey, { message: messageOf(currenciesError) })}
          </p>
        )}

        {/* The lists arrived; something about how they arrived is worth saying.
            Same place and same weight as the hint above, one tone up. */}
        <WarningNotes warnings={warnings} />
      </div>

      {/* The seam. A 1px divider carrying the swap control when the panes are
          stacked; out of the flow and centred on the column edge when they are
          side by side, which is the same place on screen either way. */}
      <div className="bg-line relative h-px sm:absolute sm:inset-x-0 sm:top-[7.875rem] sm:h-0 sm:bg-transparent">
        <SwapButton onClick={form.swap} />
      </div>

      <div className="pane-output bg-sunken border-line grid content-start gap-3 p-5 pt-8 sm:gap-3.5 sm:border-l sm:p-6">
        <CurrencySelect
          id="to"
          label={t('converter.form.to')}
          value={form.to}
          currencies={options}
          isLoading={currenciesLoading}
          error={form.errors.to}
          onChange={form.setTo}
        />

        {/* Keyed by the answer, so a new one remounts the pane and plays its
            entrance again instead of swapping numbers in place. */}
        <ResultDisplay
          key={outcome === undefined ? 'empty' : conversionKey(outcome)}
          outcome={outcome}
          isSubmitting={isSubmitting}
        />

        {outcome !== undefined && !isSubmitting && <ResultBadges outcome={outcome} />}
      </div>

      {/* Before the first conversion this block is the card's last one, and the
          provenance footer that would otherwise pad the card is not there yet:
          `last:pb-5` is the 20px board 1k puts under Convert on a phone. */}
      <div className="pane-action border-line border-t px-5 pt-4 last:pb-5 sm:border-t-0 sm:px-6 sm:pt-[1.125rem] sm:pb-6 sm:last:pb-6">
        <button
          type="submit"
          className="button button-primary w-full"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting && <Spinner className="h-4 w-4" />}
          {isSubmitting ? t('converter.form.submitting') : t('converter.form.submit')}
        </button>
      </div>

      {outcome !== undefined && <ProvenanceFooter outcome={outcome} />}
    </form>
  );
}
