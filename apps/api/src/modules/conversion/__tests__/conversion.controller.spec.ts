import { ConversionController } from '../conversion.controller';
import { ConversionService } from '../conversion.service';
import { ConversionResult } from '../domain/conversion-result';

const RESULT: ConversionResult = {
  from: 'EUR',
  to: 'GBP',
  amount: 100,
  result: 84.73,
  rate: 0.847312,
  strategy: 'cross',
  source: 'cache',
  ratesTimestamp: '2026-09-08T12:00:00.000Z',
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
    service = { convert: jest.fn().mockResolvedValue(RESULT) };
    controller = new ConversionController(
      service as unknown as ConversionService,
    );
  });

  it('answers with what the service produced', async () => {
    await expect(
      controller.convert({ from: 'EUR', to: 'GBP', amount: 100 }),
    ).resolves.toStrictEqual(RESULT);
  });

  it('hands the validated request straight to the service', async () => {
    await controller.convert({ from: 'EUR', to: 'GBP', amount: 100 });

    expect(service.convert).toHaveBeenCalledWith({
      from: 'EUR',
      to: 'GBP',
      amount: 100,
    });
  });

  it('lets a service failure through to the exception filter', async () => {
    service.convert.mockRejectedValue(new Error('rates are gone'));

    await expect(
      controller.convert({ from: 'EUR', to: 'GBP', amount: 100 }),
    ).rejects.toThrow('rates are gone');
  });
});
