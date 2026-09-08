import { ConversionController } from '../conversion.controller';
import { ConversionService } from '../conversion.service';
import { ConversionOutcome } from '../domain/conversion-outcome';

const REQUEST = { from: 'EUR', to: 'GBP', amount: 100 };

const OUTCOME: ConversionOutcome = {
  result: {
    from: 'EUR',
    to: 'GBP',
    amount: 100,
    result: 84.73,
    rate: 0.847312,
    strategy: 'cross',
    source: 'cache',
    ratesTimestamp: '2026-09-08T12:00:00.000Z',
  },
  cacheDegraded: false,
  recorded: true,
};

// Declared as properties rather than by extending the service: a jest.Mock read
// off a method signature is what the unbound-method rule exists to catch.
interface ServiceDouble {
  convert: jest.Mock;
}

describe('ConversionController', () => {
  let service: ServiceDouble;
  let controller: ConversionController;

  beforeEach(() => {
    service = { convert: jest.fn().mockResolvedValue(OUTCOME) };
    controller = new ConversionController(
      service as unknown as ConversionService,
    );
  });

  it('answers with the conversion the service priced', async () => {
    await expect(controller.convert(REQUEST)).resolves.toStrictEqual(
      OUTCOME.result,
    );
  });

  it('hands the validated request straight to the service', async () => {
    await controller.convert(REQUEST);

    expect(service.convert).toHaveBeenCalledWith(REQUEST);
  });

  it('lets a service failure through to the exception filter', async () => {
    service.convert.mockRejectedValue(new Error('rates are gone'));

    await expect(controller.convert(REQUEST)).rejects.toThrow('rates are gone');
  });

  // The warnings are assembled here rather than in the service, which is where
  // /rates assembles its own: what degraded is a fact about the request, and
  // the domain result the history stores has no field for it.
  describe('the warnings it assembles', () => {
    it('reports a cache that could not be reached', async () => {
      service.convert.mockResolvedValue({ ...OUTCOME, cacheDegraded: true });

      await expect(controller.convert(REQUEST)).resolves.toMatchObject({
        warnings: [
          { code: 'CACHE_UNAVAILABLE', message: expect.any(String) as string },
        ],
      });
    });

    // The conversion is answered whatever the store did, and this is the part
    // of that the client cannot see for itself: /history will not have it.
    it('reports a conversion the history did not take', async () => {
      service.convert.mockResolvedValue({ ...OUTCOME, recorded: false });

      await expect(controller.convert(REQUEST)).resolves.toMatchObject({
        warnings: [
          {
            code: 'HISTORY_NOT_RECORDED',
            message: expect.any(String) as string,
          },
        ],
      });
    });

    it('reports both degradations of one request, in the documented order', async () => {
      service.convert.mockResolvedValue({
        ...OUTCOME,
        cacheDegraded: true,
        recorded: false,
      });

      const response = await controller.convert(REQUEST);

      expect(response.warnings?.map((warning) => warning.code)).toStrictEqual([
        'CACHE_UNAVAILABLE',
        'HISTORY_NOT_RECORDED',
      ]);
    });

    // §3: absent rather than empty, so a healthy answer is byte for byte the
    // one this route has always given.
    it('carries no warnings field at all when nothing degraded', async () => {
      const response = await controller.convert(REQUEST);

      expect(response).not.toHaveProperty('warnings');
    });
  });
});
