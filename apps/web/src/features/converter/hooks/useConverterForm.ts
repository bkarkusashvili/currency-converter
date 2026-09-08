import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvertRequest } from '../../../api/types';
import { useFormatters } from '../../../lib/useFormatters';
import { canonicalAmount } from '../lib/canonicalAmount';
import { DEFAULT_FROM, DEFAULT_TO } from '../lib/defaultCurrencies';
import { MAX_AMOUNT, parseAmount, type AmountErrorCode } from '../lib/parseAmount';
import type { FormField, FormFieldErrors } from '../lib/serverFieldErrors';

const DEFAULT_AMOUNT = '100';

interface UseConverterFormOptions {
  serverErrors: FormFieldErrors;
  onSubmit: (request: ConvertRequest) => void;
  /** Called instead of submitting, so the form can put the caret on what needs fixing. */
  onAmountInvalid: () => void;
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
}: UseConverterFormOptions): ConverterFormState {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [amount, setAmountValue] = useState(DEFAULT_AMOUNT);
  const [from, setFromValue] = useState(DEFAULT_FROM);
  const [to, setToValue] = useState(DEFAULT_TO);
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
    setFromValue(value);
    markEdited('from');
  }

  function setTo(value: string) {
    setToValue(value);
    markEdited('to');
  }

  function swap() {
    setFromValue(to);
    setToValue(from);
    markEdited('from', 'to');
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
