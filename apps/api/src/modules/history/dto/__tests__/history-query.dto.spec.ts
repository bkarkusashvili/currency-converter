import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { FieldValidationError } from '../../../../common/validation/field-validation-error';
import { validationPipeOptions } from '../../../../common/validation/validation-pipe.options';
import {
  DEFAULT_HISTORY_LIMIT,
  HistoryQueryDto,
  MAX_HISTORY_LIMIT,
} from '../history-query.dto';

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

  async function fields(query: unknown): Promise<string[]> {
    try {
      await pipe.transform(query, metadata);
    } catch (error) {
      const payload = (
        error as { getResponse(): { errors: FieldValidationError[] } }
      ).getResponse();

      return payload.errors.map((failure) => failure.field);
    }

    throw new Error('the pipe accepted a query it should have rejected');
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

  it('rejects a parameter it does not document', async () => {
    await expect(fields({ offset: '10' })).resolves.toStrictEqual(['offset']);
  });
});
