import {
  createFakePinoLogger,
  FakePinoLogger,
} from '../../../../../common/logging/__tests__/fake-pino-logger';
import { ExchangeRate } from '../../../domain/exchange-rate';
import { MonobankRate } from '../monobank-rate.schema';
import { mapMonobankRates } from '../monobank-rates.mapper';

const DATE_SECONDS = 1_757_332_800;
const DATE_ISO = '2025-09-08T12:00:00.000Z';

describe('mapMonobankRates', () => {
  let logger: FakePinoLogger;

  beforeEach(() => {
    logger = createFakePinoLogger();
  });

  function map(...raw: MonobankRate[]): ExchangeRate[] {
    return mapMonobankRates(raw, logger.asPinoLogger());
  }

  it('names both currencies and turns unix seconds into an ISO timestamp', () => {
    expect(
      map({
        currencyCodeA: 840,
        currencyCodeB: 980,
        date: DATE_SECONDS,
        rateBuy: 44.35,
        rateSell: 44.831,
      }),
    ).toStrictEqual([
      {
        base: 'USD',
        quote: 'UAH',
        buy: 44.35,
        sell: 44.831,
        cross: undefined,
        date: DATE_ISO,
      },
    ]);
  });

  it('keeps a pair quoted with a cross rate only', () => {
    expect(
      map({
        currencyCodeA: 826,
        currencyCodeB: 980,
        date: DATE_SECONDS,
        rateCross: 60.7562,
      }),
    ).toMatchObject([{ base: 'GBP', quote: 'UAH', cross: 60.7562 }]);
  });

  it('drops a pair whose numeric code is not in ISO 4217, and says so', () => {
    expect(
      map({
        currencyCodeA: 111,
        currencyCodeB: 980,
        date: DATE_SECONDS,
        rateCross: 1,
      }),
    ).toStrictEqual([]);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('111/980'),
    );
  });

  it('drops a pair with no usable rate, and says so', () => {
    expect(
      map({ currencyCodeA: 840, currencyCodeB: 980, date: DATE_SECONDS }),
    ).toStrictEqual([]);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('USD/UAH'),
    );
  });

  it('keeps the entries around the ones it drops', () => {
    const rates = map(
      {
        currencyCodeA: 840,
        currencyCodeB: 980,
        date: DATE_SECONDS,
        rateBuy: 44.35,
      },
      {
        currencyCodeA: 111,
        currencyCodeB: 980,
        date: DATE_SECONDS,
        rateCross: 1,
      },
      {
        currencyCodeA: 978,
        currencyCodeB: 840,
        date: DATE_SECONDS,
        rateCross: 1.17,
      },
    );

    expect(rates.map(({ base, quote }) => `${base}/${quote}`)).toStrictEqual([
      'USD/UAH',
      'EUR/USD',
    ]);
  });

  it('maps an empty payload to an empty snapshot', () => {
    expect(map()).toStrictEqual([]);
  });
});
