import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvertRequest } from '../../../api';
import { useFormatters } from '../../../lib';
import { canonicalAmount } from '../lib/amount/formatAmountInput';
import { DEFAULT_FROM, DEFAULT_TO } from '../lib/currencyOptions';
import {
  MAX_AMOUNT,
  parseAmount,
  type AmountErrorCode,
  type ParsedAmount,
} from '../lib/amount/parseAmount';
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

  /**
   * The number the amount field stands for. It writes its value in the active
   * locale, and Enter submits without blurring, so what is in it is neither the
   * number nor necessarily finished: `canonicalAmount` is what turns one into
   * the other.
   */
  function currentAmount(): ParsedAmount {
    return parseAmount(canonicalAmount(amount, formatters.separators));
  }

  function submit(nextFrom: string, nextTo: string, value: number) {
    setAmountErrorCode(null);
    // The server's next answer describes these values, so nothing is
    // outstanding to keep an error off a field any more.
    setEditedFields(EMPTY_FIELDS);
    onSubmit({ from: nextFrom.toUpperCase(), to: nextTo.toUpperCase(), amount: value });
  }

  /**
   * Swapping and picking both change the question the answer on screen is
   * answering, so it is asked again for the pair now selected rather than left
   * standing beside controls that no longer describe it. The request goes out
   * the same way Convert sends one, and supersedes one already in flight the
   * same way a second press does.
   *
   * An amount that would not submit is left alone: the swap or the pick still
   * happens, in silence, and Convert still says what is wrong with the amount
   * when it is pressed.
   */
  function reconvert(nextFrom: string, nextTo: string) {
    const parsed = currentAmount();
    if (parsed.ok) {
      submit(nextFrom, nextTo, parsed.value);
    }
  }

  function setFrom(value: string) {
    setFromValue(value);
    markEdited('from');
    reconvert(value, to);
  }

  function setTo(value: string) {
    setToValue(value);
    markEdited('to');
    reconvert(from, value);
  }

  function swap() {
    setFromValue(to);
    setToValue(from);
    markEdited('from', 'to');
    reconvert(to, from);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = currentAmount();
    if (!parsed.ok) {
      setAmountErrorCode(parsed.error);
      onAmountInvalid();
      return;
    }

    submit(from, to, parsed.value);
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
