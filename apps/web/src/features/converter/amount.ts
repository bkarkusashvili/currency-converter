const MAX_AMOUNT = 1_000_000_000_000;

export type ParsedAmount = { ok: true; value: number } | { ok: false; message: string };

export function parseAmount(input: string): ParsedAmount {
  const normalised = input.trim().replace(',', '.');

  if (normalised === '') {
    return { ok: false, message: 'Enter an amount to convert.' };
  }

  const value = Number(normalised);

  if (!Number.isFinite(value)) {
    return { ok: false, message: 'Amount must be a number, for example 250.75.' };
  }
  if (value <= 0) {
    return { ok: false, message: 'Amount must be greater than zero.' };
  }
  if (value > MAX_AMOUNT) {
    return { ok: false, message: 'Amount must be 1,000,000,000,000 or less.' };
  }

  return { ok: true, value };
}
