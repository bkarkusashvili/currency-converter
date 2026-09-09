import { PinoLogger } from 'nestjs-pino';
import { alphaFromNumeric } from '../../../../common/currency';
import { ExchangeRate } from '../../domain/exchange-rate.types';
import { MonobankRate } from './monobank-rate.schema';

const MILLISECONDS_PER_SECOND = 1000;

function hasUsableRate(entry: MonobankRate): boolean {
  return (
    entry.rateBuy !== undefined ||
    entry.rateSell !== undefined ||
    entry.rateCross !== undefined
  );
}

// Monobank publishes numeric codes and unix seconds, and it publishes pairs
// this API cannot quote — codes outside ISO 4217 and entries with every rate
// missing. Dropping them here keeps every consumer of a snapshot free of the
// upstream's shape.
export function mapMonobankRates(
  raw: readonly MonobankRate[],
  logger: PinoLogger,
): ExchangeRate[] {
  const rates: ExchangeRate[] = [];

  for (const entry of raw) {
    const base = alphaFromNumeric(entry.currencyCodeA);
    const quote = alphaFromNumeric(entry.currencyCodeB);

    if (base === undefined || quote === undefined) {
      logger.debug(
        `Dropping a rate with an unknown ISO 4217 code: ${entry.currencyCodeA}/${entry.currencyCodeB}`,
      );
      continue;
    }

    if (!hasUsableRate(entry)) {
      logger.debug(`Dropping ${base}/${quote}: no buy, sell or cross rate`);
      continue;
    }

    rates.push({
      base,
      quote,
      buy: entry.rateBuy,
      sell: entry.rateSell,
      cross: entry.rateCross,
      date: new Date(entry.date * MILLISECONDS_PER_SECOND).toISOString(),
    });
  }

  return rates;
}
