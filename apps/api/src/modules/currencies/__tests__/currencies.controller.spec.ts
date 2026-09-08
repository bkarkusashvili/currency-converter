import { RatesService } from '../../rates/application/rates.service';
import { RatesLookup } from '../../rates/domain/exchange-rate';
import { CurrenciesController } from '../currencies.controller';

const LOOKUP: RatesLookup = {
  source: 'cache',
  cacheDegraded: false,
  snapshot: {
    fetchedAt: '2026-09-08T12:00:00.000Z',
    rates: [
      {
        base: 'USD',
        quote: 'UAH',
        buy: 44.35,
        date: '2026-09-08T11:00:00.000Z',
      },
      {
        base: 'EUR',
        quote: 'USD',
        cross: 1.17,
        date: '2026-09-08T11:00:00.000Z',
      },
    ],
  },
};

interface ServiceDouble {
  getSnapshot: jest.Mock;
}

describe('CurrenciesController', () => {
  let service: ServiceDouble;
  let controller: CurrenciesController;

  beforeEach(() => {
    service = { getSnapshot: jest.fn().mockResolvedValue(LOOKUP) };
    controller = new CurrenciesController(service as unknown as RatesService);
  });

  it('lists the currencies of the current snapshot', async () => {
    await expect(controller.list()).resolves.toStrictEqual({
      currencies: [
        { code: 'EUR', numericCode: 978, name: 'Euro' },
        { code: 'UAH', numericCode: 980, name: 'Hryvnia' },
        { code: 'USD', numericCode: 840, name: 'US Dollar' },
      ],
    });
  });

  // The endpoint exists to say what can be converted, so it has to read the
  // snapshot a conversion would read rather than a list of its own.
  it('reads the snapshot through the rates service', async () => {
    await controller.list();

    expect(service.getSnapshot).toHaveBeenCalledTimes(1);
  });

  // The same read as /rates, so the same degradation: the list was served, and
  // reaching the cache is what it cost. Without this the one route of the three
  // that reads a snapshot silently would be the one a picker calls first.
  it('reports a cache that could not be reached as a warning', async () => {
    service.getSnapshot.mockResolvedValue({ ...LOOKUP, cacheDegraded: true });

    await expect(controller.list()).resolves.toMatchObject({
      warnings: [
        { code: 'CACHE_UNAVAILABLE', message: expect.any(String) as string },
      ],
    });
  });

  // Absent rather than empty, so a healthy answer is exactly what it was.
  it('carries no warnings field at all when nothing degraded', async () => {
    await expect(controller.list()).resolves.not.toHaveProperty('warnings');
  });

  it('lets an unavailable snapshot through to the exception filter', async () => {
    service.getSnapshot.mockRejectedValue(new Error('rates are gone'));

    await expect(controller.list()).rejects.toThrow('rates are gone');
  });
});
