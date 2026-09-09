import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { FieldValidationError } from '../../../../common/validation/field-validation-error.types';
import { validationPipeOptions } from '../../../../common/validation/validation-pipe.options';
import { RatesHistoryQueryDto } from '../rates-history-query.dto';

const metadata: ArgumentMetadata = {
  type: 'query',
  metatype: RatesHistoryQueryDto,
};

const pipe = new ValidationPipe(validationPipeOptions);

// A query string is text: this is what Express hands the pipe, and it is why
// `days` needs its own @Type rather than implicit conversion.
const VALID = { base: 'usd', quote: 'uah' };

async function transform(query: unknown): Promise<RatesHistoryQueryDto> {
  return (await pipe.transform(query, metadata)) as RatesHistoryQueryDto;
}

async function fields(query: unknown): Promise<string[]> {
  try {
    await transform(query);
  } catch (error) {
    const payload = (
      error as { getResponse(): { errors: unknown } }
    ).getResponse();

    return (payload.errors as FieldValidationError[]).map(
      (entry) => entry.field,
    );
  }

  throw new Error('the pipe accepted a query it should have rejected');
}

describe('RatesHistoryQueryDto', () => {
  it('upper-cases the codes it accepts', async () => {
    await expect(transform(VALID)).resolves.toMatchObject({
      base: 'USD',
      quote: 'UAH',
    });
  });

  it('defaults the window to a week', async () => {
    await expect(transform(VALID)).resolves.toMatchObject({ days: 7 });
  });

  it('converts the days it is given from the string a query carries', async () => {
    await expect(transform({ ...VALID, days: '30' })).resolves.toMatchObject({
      days: 30,
    });
  });

  it.each([['0'], ['91'], ['abc'], ['1.5'], ['-1']])(
    'rejects ?days=%s, naming the field',
    async (days) => {
      await expect(fields({ ...VALID, days })).resolves.toStrictEqual(['days']);
    },
  );

  it.each([['base'], ['quote']])('requires %s', async (field) => {
    const query: Record<string, unknown> = { ...VALID };
    delete query[field];

    await expect(fields(query)).resolves.toStrictEqual([field]);
  });

  it.each([['US'], ['USDD'], ['US1'], ['']])(
    'rejects the code %p',
    async (base) => {
      await expect(fields({ ...VALID, base })).resolves.toStrictEqual(['base']);
    },
  );

  // The window is the archive's retention, not a page size, so a request past
  // it could never be answered rather than answered short.
  it('accepts the widest window the archive keeps', async () => {
    await expect(transform({ ...VALID, days: '90' })).resolves.toMatchObject({
      days: 90,
    });
  });

  it('rejects a property the request has no business sending', async () => {
    await expect(fields({ ...VALID, base2: 'EUR' })).resolves.toStrictEqual([
      'base2',
    ]);
  });
});
