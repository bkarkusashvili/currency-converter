import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvertRequest } from '../../../api/types';
import { useFormatters } from '../../../lib/useFormatters';
import { MAX_AMOUNT, parseAmount, type AmountErrorCode } from '../lib/parseAmount';
import type { FormField, FormFieldErrors } from '../lib/serverFieldErrors';

export const DEFAULT_FROM = 'USD';
export const DEFAULT_TO = 'UAH';
const DEFAULT_AMOUNT = '100';

interface UseConverterFormOptions {
  serverErrors: FormFieldErrors;
  onSubmit: (request: ConvertRequest) => void;
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
}: UseConverterFormOptions): ConverterFormState {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const [amount, setAmountValue] = useState(DEFAULT_AMOUNT);
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [amountErrorCode, setAmountErrorCode] = useState<AmountErrorCode | null>(null);

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

  function setAmount(value: string) {
    setAmountValue(value);
    setAmountErrorCode(null);
  }

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseAmount(amount);
    if (!parsed.ok) {
      setAmountErrorCode(parsed.error);
      return;
    }

    setAmountErrorCode(null);
    onSubmit({ from: from.toUpperCase(), to: to.toUpperCase(), amount: parsed.value });
  }

  const errors: Record<FormField, string | null> = {
    amount: amountErrorCode === null ? joined(serverErrors.amount) : amountMessage(amountErrorCode),
    from: joined(serverErrors.from),
    to: joined(serverErrors.to),
  };

  return { amount, from, to, errors, setAmount, setFrom, setTo, swap, handleSubmit };
}

function joined(messages: string[] | undefined): string | null {
  return messages === undefined || messages.length === 0 ? null : messages.join(' ');
}
