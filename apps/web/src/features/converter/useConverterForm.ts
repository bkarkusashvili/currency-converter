import { useState, type FormEvent } from 'react';
import type { ConvertRequest } from '../../api/types';
import { parseAmount } from './amount';

export const DEFAULT_FROM = 'USD';
export const DEFAULT_TO = 'UAH';
const DEFAULT_AMOUNT = '100';

interface ConverterForm {
  amount: string;
  from: string;
  to: string;
  amountError: string | null;
  setAmount: (value: string) => void;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  swap: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function useConverterForm(onSubmit: (request: ConvertRequest) => void): ConverterForm {
  const [amount, setAmountValue] = useState(DEFAULT_AMOUNT);
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [amountError, setAmountError] = useState<string | null>(null);

  function setAmount(value: string) {
    setAmountValue(value);
    setAmountError(null);
  }

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseAmount(amount);
    if (!parsed.ok) {
      setAmountError(parsed.message);
      return;
    }

    setAmountError(null);
    onSubmit({ from: from.toUpperCase(), to: to.toUpperCase(), amount: parsed.value });
  }

  return { amount, from, to, amountError, setAmount, setFrom, setTo, swap, handleSubmit };
}
