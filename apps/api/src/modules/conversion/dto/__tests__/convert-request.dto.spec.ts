import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { FieldValidationError } from '../../../../common/validation/field-validation-error';
import { validationPipeOptions } from '../../../../common/validation/validation-pipe.options';
import { ConvertRequestDto } from '../convert-request.dto';

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: ConvertRequestDto,
};

const VALID = { from: 'EUR', to: 'GBP', amount: 100 };

// The DTO is only half of the boundary; the pipe the app registers is the other
// half, and running them together is what makes a case like the string amount
// mean what it means in production.
describe('ConvertRequestDto', () => {
  const pipe = new ValidationPipe(validationPipeOptions);

  async function accept(body: unknown): Promise<ConvertRequestDto> {
    // ValidationPipe.transform is typed as any.
    return (await pipe.transform(body, metadata)) as ConvertRequestDto;
  }

  async function reject(body: unknown): Promise<FieldValidationError[]> {
    try {
      await pipe.transform(body, metadata);
    } catch (error) {
      const payload = (
        error as { getResponse(): { errors: unknown } }
      ).getResponse();

      return payload.errors as FieldValidationError[];
    }

    throw new Error('the pipe accepted a body it should have rejected');
  }

  async function fields(body: unknown): Promise<string[]> {
    return (await reject(body)).map((error) => error.field);
  }

  it('takes a well formed body as it was sent', async () => {
    await expect(accept(VALID)).resolves.toStrictEqual(
      Object.assign(new ConvertRequestDto(), VALID),
    );
  });

  it('normalises the codes to upper case', async () => {
    await expect(
      accept({ ...VALID, from: 'eur', to: 'gBp' }),
    ).resolves.toMatchObject({ from: 'EUR', to: 'GBP' });
  });

  it('takes a fractional amount', async () => {
    await expect(accept({ ...VALID, amount: 0.01 })).resolves.toMatchObject({
      amount: 0.01,
    });
  });

  it('takes the largest amount it documents', async () => {
    await expect(
      accept({ ...VALID, amount: 1_000_000_000_000 }),
    ).resolves.toMatchObject({ amount: 1_000_000_000_000 });
  });

  // The pipe does not coerce, so a client that sends its amount as a string is
  // told about it rather than having "100" quietly become 100 — or "1e5" become
  // something it did not mean.
  it('rejects an amount sent as a string', async () => {
    await expect(fields({ ...VALID, amount: '100' })).resolves.toStrictEqual([
      'amount',
    ]);
  });

  it.each([[0], [-1], [1_000_000_000_001]])(
    'rejects %p as an amount',
    async (amount) => {
      await expect(fields({ ...VALID, amount })).resolves.toStrictEqual([
        'amount',
      ]);
    },
  );

  it.each([['US'], ['USDD'], ['840'], ['US$'], [''], [978]])(
    'rejects %p as a currency code',
    async (from) => {
      await expect(fields({ ...VALID, from })).resolves.toStrictEqual(['from']);
    },
  );

  it('reports every missing field at once', async () => {
    await expect(fields({})).resolves.toStrictEqual(['from', 'to', 'amount']);
  });

  it('rejects a property the request has no business sending', async () => {
    await expect(fields({ ...VALID, rate: 1.2 })).resolves.toStrictEqual([
      'rate',
    ]);
  });
});
