import { z } from 'zod';

const cachedExchangeRateSchema = z.object({
  base: z.string(),
  quote: z.string(),
  buy: z.number().optional(),
  sell: z.number().optional(),
  cross: z.number().optional(),
  date: z.string(),
});

// A cached value is not trusted just because this process wrote it: the key
// outlives a deploy and is shared by every instance, so a snapshot written by
// an older shape would otherwise reach a response unchecked.
export const cachedRatesSnapshotSchema = z.object({
  fetchedAt: z.string(),
  rates: z.array(cachedExchangeRateSchema),
});
