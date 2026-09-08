import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { FieldValidationError } from '../../../../common/validation/field-validation-error';
import { validationPipeOptions } from '../../../../common/validation/validation-pipe.options';
import {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
} from '../../domain/history-limits';
import { HistoryQueryDto } from '../history-query.dto';

const metadata: ArgumentMetadata = {
  type: 'query',
  metatype: HistoryQueryDto,
};

// A query string is always text, so the DTO is only meaningful together with
// the pipe the app registers: the global options do not convert implicitly, and
// whether `?limit=10` arrives as a number at all is what is under test.
describe('HistoryQueryDto', () => {
  const pipe = new ValidationPipe(validationPipeOptions);

  async function accept(query: unknown): Promise<HistoryQueryDto> {
    // ValidationPipe.transform is typed as any.
    return (await pipe.transform(query, metadata)) as HistoryQueryDto;
  }

  async function reject(query: unknown): Promise<FieldValidationError[]> {
    try {
      await pipe.transform(query, metadata);
    } catch (error) {
      const payload = (
        error as { getResponse(): { errors: FieldValidationError[] } }
      ).getResponse();

      return payload.errors;
    }

    throw new Error('the pipe accepted a query it should have rejected');
  }

  async function fields(query: unknown): Promise<string[]> {
    return (await reject(query)).map((failure) => failure.field);
  }

  it('defaults to the documented page size', async () => {
    await expect(accept({})).resolves.toStrictEqual(
      Object.assign(new HistoryQueryDto(), { limit: DEFAULT_HISTORY_LIMIT }),
    );
  });

  it('reads the limit as a number rather than as the text it arrives as', async () => {
    await expect(accept({ limit: '25' })).resolves.toMatchObject({ limit: 25 });
  });

  it.each([['1'], [String(MAX_HISTORY_LIMIT)]])(
    'takes %s, a bound it documents',
    async (limit) => {
      await expect(accept({ limit })).resolves.toMatchObject({
        limit: Number(limit),
      });
    },
  );

  // Without the explicit conversion this would arrive as NaN and read as no
  // limit at all rather than as a request the API refuses.
  it.each([['abc'], ['0'], ['-1'], ['51'], ['1.5'], ['']])(
    'rejects %p, naming the field',
    async (limit) => {
      await expect(fields({ limit })).resolves.toStrictEqual(['limit']);
    },
  );

  // The bound that was broken, rather than every bound the value is outside:
  // `?limit=abc` is NaN, which is neither an integer nor within 1..50, and only
  // the first of those tells the caller what to send.
  it.each([
    ['abc', 'limit must be an integer number'],
    ['0', 'limit must not be less than 1'],
    ['51', 'limit must not be greater than 50'],
  ])('reports %p as exactly one message', async (limit, message) => {
    const [error] = await reject({ limit });

    expect(error!.messages).toStrictEqual([message]);
  });

  it('rejects a parameter it does not document', async () => {
    await expect(fields({ offset: '10' })).resolves.toStrictEqual(['offset']);
  });
});
