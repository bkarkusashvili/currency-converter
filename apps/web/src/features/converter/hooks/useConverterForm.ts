import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvertRequest } from '../../../api';
import { useFormatters } from '../../../lib';
import { canonicalAmount } from '../lib/amount/formatAmountInput';
import { MAX_AMOUNT, parseAmount, type AmountErrorCode } from '../lib/amount/parseAmount';
import type { CurrencyPair } from '../lib/currencyPair';
import type { FormField, FormFieldErrors } from '../lib/serverFieldErrors';

const DEFAULT_AMOUNT = '100';

interface UseConverterFormOptions {
  serverErrors: FormFieldErrors;
  onSubmit: (request: ConvertRequest) => void;
  /** Called instead of submitting, so the form can put the caret on what needs fixing. */
  onAmountInvalid: () => void;
  /**
   * The pair, owned by the page. The rate-history panel under the card is on
   * the *selected* pair rather than the converted one, so it follows a pick
   * and a swap without waiting for a conversion (§5.2) — and it reads the same
   * state the selects render, not a copy of it kept in step by a callback.
   */
  pair: CurrencyPair;
  onPairChange: (pair: CurrencyPair) => void;
}

export interface ConverterFormState {
  amount: string;
  from: string;
  to: string;
  errors: Record<FormField, string | null>;
  setAmount: (value: string) => void;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  swap: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function useConverterForm({
  serverErrors,
  onSubmit,
  onAmountInvalid,
  pair,
  onPairChange,
}: UseConverterFormOptions): ConverterFormState {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const { from, to } = pair;
  const [amount, setAmountValue] = useState(DEFAULT_AMOUNT);
  const [amountErrorCode, setAmountErrorCode] = useState<AmountErrorCode | null>(null);
  /**
   * Fields edited since the last submit. The server's answer describes the values
   * it was sent, so a field the user has already changed must not keep wearing
   * `aria-invalid` until the next mutation settles.
   */
  const [editedFields, setEditedFields] = useState<ReadonlySet<FormField>>(EMPTY_FIELDS);

  function amountMessage(code: AmountErrorCode): string {
    switch (code) {
      case 'empty':
        return t('converter.amountErrors.empty');
      case 'notANumber':
        return t('converter.amountErrors.notANumber');
      case 'notPositive':
        return t('converter.amountErrors.notPositive');
      case 'tooLarge':
        return t('converter.amountErrors.tooLarge', { max: formatters.integer(MAX_AMOUNT) });
    }
  }

  function markEdited(...fields: FormField[]) {
    setEditedFields((edited) => new Set([...edited, ...fields]));
  }

  function setAmount(value: string) {
    setAmountValue(value);
    setAmountErrorCode(null);
    markEdited('amount');
  }

  function setFrom(value: string) {
    markEdited('from');
    onPairChange({ from: value, to });
  }

  function setTo(value: string) {
    markEdited('to');
    onPairChange({ from, to: value });
  }

  function swap() {
    markEdited('from', 'to');
    onPairChange({ from: to, to: from });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The field writes its value in the active locale, and Enter submits
    // without blurring, so what is in it on submit is neither the number nor
    // necessarily finished. `canonicalAmount` is what turns one into the other.
    const parsed = parseAmount(canonicalAmount(amount, formatters.separators));
    if (!parsed.ok) {
      setAmountErrorCode(parsed.error);
      onAmountInvalid();
      return;
    }

    setAmountErrorCode(null);
    setEditedFields(EMPTY_FIELDS);
    onSubmit({ from: from.toUpperCase(), to: to.toUpperCase(), amount: parsed.value });
  }

  function serverMessage(field: FormField): string | null {
    return editedFields.has(field) ? null : joined(serverErrors[field]);
  }

  const errors: Record<FormField, string | null> = {
    amount: amountErrorCode === null ? serverMessage('amount') : amountMessage(amountErrorCode),
    from: serverMessage('from'),
    to: serverMessage('to'),
  };

  return { amount, from, to, errors, setAmount, setFrom, setTo, swap, handleSubmit };
}

const EMPTY_FIELDS: ReadonlySet<FormField> = new Set();

function joined(messages: string[] | undefined): string | null {
  return messages === undefined || messages.length === 0 ? null : messages.join(' ');
}
