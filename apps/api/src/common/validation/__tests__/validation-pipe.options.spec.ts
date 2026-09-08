import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';
import { FieldValidationError } from '../field-validation-error';
import { validationPipeOptions } from '../validation-pipe.options';

// Stands in for the DTOs the later modules bring; the point is the pipe's
// behaviour, which is the same whichever DTO it is handed.
class SampleDto {
  @IsString()
  from!: string;

  @IsInt()
  amount!: number;

  @IsInt()
  @Type(() => Number)
  precision!: number;
}

const metadata: ArgumentMetadata = { type: 'body', metatype: SampleDto };

describe('validationPipeOptions', () => {
  const pipe = new ValidationPipe(validationPipeOptions);

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

  it('turns an acceptable body into an instance of the DTO', async () => {
    // ValidationPipe.transform is typed as any.
    const body = (await pipe.transform(
      { from: 'EUR', amount: 100, precision: '2' },
      metadata,
    )) as SampleDto;

    expect(body).toBeInstanceOf(SampleDto);
    expect(body).toStrictEqual(
      Object.assign(new SampleDto(), {
        from: 'EUR',
        amount: 100,
        precision: 2,
      }),
    );
  });

  it('rejects a property the DTO does not declare instead of ignoring it', async () => {
    const errors = await reject({
      from: 'EUR',
      amount: 100,
      precision: 2,
      surprise: 'x',
    });

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'surprise' }),
    );
  });

  // Implicit conversion would turn "abc" into NaN and let it through as a
  // number; a DTO opts into coercion explicitly with @Type instead.
  it('does not coerce a field that did not ask to be coerced', async () => {
    const errors = await reject({ from: 'EUR', amount: 'abc', precision: 2 });

    expect(errors).toContainEqual(expect.objectContaining({ field: 'amount' }));
  });

  it('reports every failure of the body in one response', async () => {
    const errors = await reject({ amount: 'abc', precision: 'abc' });

    expect(errors.map((error) => error.field).sort()).toStrictEqual([
      'amount',
      'from',
      'precision',
    ]);
  });

  it('reports the failures as the field and message pairs the envelope carries', async () => {
    const [error] = await reject({ from: 1, amount: 1, precision: 1 });

    expect(error).toStrictEqual({
      field: 'from',
      messages: [expect.stringContaining('from') as string],
    });
  });
});
