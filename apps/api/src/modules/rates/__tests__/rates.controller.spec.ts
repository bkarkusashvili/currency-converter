import { RatesLookup } from '../domain/rates-lookup';
import { RatesService } from '../application/rates.service';
import { RatesController } from '../rates.controller';

const LOOKUP: RatesLookup = {
  source: 'cache',
  snapshot: {
    fetchedAt: '2026-09-08T12:00:00.000Z',
    rates: [
      {
        base: 'USD',
        quote: 'UAH',
        buy: 44.35,
        sell: 44.831,
        date: '2026-09-08T11:00:00.000Z',
      },
    ],
  },
};

// Declared as properties rather than by extending the service: a jest.Mock
// read off a method signature is what the unbound-method rule exists to catch.
interface ServiceDouble {
  getSnapshot: jest.Mock;
  invalidate: jest.Mock;
}

describe('RatesController', () => {
  let service: ServiceDouble;
  let controller: RatesController;

  beforeEach(() => {
    service = {
      getSnapshot: jest.fn().mockResolvedValue(LOOKUP),
      invalidate: jest.fn().mockResolvedValue(undefined),
    };
    controller = new RatesController(service as unknown as RatesService);
  });

  describe('GET /rates', () => {
    it('flattens the lookup into the documented response', async () => {
      await expect(controller.getRates()).resolves.toStrictEqual({
        source: 'cache',
        fetchedAt: LOOKUP.snapshot.fetchedAt,
        rates: LOOKUP.snapshot.rates,
      });
    });

    // The source is the whole point of reporting one: a client that cannot
    // tell a fresh answer from a fallback has no reason to be told either.
    it('reports the source the service served the snapshot from', async () => {
      service.getSnapshot.mockResolvedValue({
        ...LOOKUP,
        source: 'stale-cache',
      });

      await expect(controller.getRates()).resolves.toMatchObject({
        source: 'stale-cache',
      });
    });

    it('lets a service failure through to the exception filter', async () => {
      service.getSnapshot.mockRejectedValue(new Error('rates are gone'));

      await expect(controller.getRates()).rejects.toThrow('rates are gone');
    });
  });

  describe('DELETE /rates/cache', () => {
    it('asks the service to invalidate and answers with no body', async () => {
      await expect(controller.invalidate()).resolves.toBeUndefined();

      expect(service.invalidate).toHaveBeenCalledTimes(1);
    });
  });
});
