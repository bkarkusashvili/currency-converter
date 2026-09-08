import { z } from 'zod';

const rate = z.number().positive();

// Unknown fields are ignored rather than rejected: a field Monobank adds must
// not be able to take this API down. What is validated is what is read.
const monobankRateSchema = z.object({
  currencyCodeA: z.number().int(),
  currencyCodeB: z.number().int(),
  date: z.number().int(),
  rateBuy: rate.optional(),
  rateSell: rate.optional(),
  rateCross: rate.optional(),
});

export const monobankRatesSchema = z.array(monobankRateSchema);

export type MonobankRate = z.infer<typeof monobankRateSchema>;
