import { ValidationError } from '@nestjs/common';
import { flattenValidationErrors } from '../flatten-validation-errors';

function error(partial: Partial<ValidationError>): ValidationError {
  return { property: 'unknown', ...partial };
}

describe('flattenValidationErrors', () => {
  it('returns nothing for an empty list', () => {
    expect(flattenValidationErrors([])).toStrictEqual([]);
  });

  it('collects every constraint message for a field', () => {
    expect(
      flattenValidationErrors([
        error({
          property: 'amount',
          constraints: {
            isPositive: 'amount must be positive',
            isNumber: 'amount must be a number',
          },
        }),
      ]),
    ).toStrictEqual([
      {
        field: 'amount',
        messages: ['amount must be positive', 'amount must be a number'],
      },
    ]);
  });

  it('keeps one entry per field', () => {
    expect(
      flattenValidationErrors([
        error({
          property: 'from',
          constraints: { isString: 'from must be a string' },
        }),
        error({
          property: 'to',
          constraints: { isString: 'to must be a string' },
        }),
      ]),
    ).toStrictEqual([
      { field: 'from', messages: ['from must be a string'] },
      { field: 'to', messages: ['to must be a string'] },
    ]);
  });

  it('addresses a nested property by its dotted path', () => {
    expect(
      flattenValidationErrors([
        error({
          property: 'options',
          children: [
            error({
              property: 'rounding',
              children: [
                error({
                  property: 'mode',
                  constraints: { isEnum: 'mode must be a valid enum value' },
                }),
              ],
            }),
          ],
        }),
      ]),
    ).toStrictEqual([
      {
        field: 'options.rounding.mode',
        messages: ['mode must be a valid enum value'],
      },
    ]);
  });

  it('omits a parent that only groups children', () => {
    const flattened = flattenValidationErrors([
      error({
        property: 'options',
        constraints: {},
        children: [
          error({
            property: 'mode',
            constraints: { isEnum: 'mode is invalid' },
          }),
        ],
      }),
    ]);

    expect(flattened).toStrictEqual([
      { field: 'options.mode', messages: ['mode is invalid'] },
    ]);
  });

  it('reports a parent that fails in its own right alongside its children', () => {
    expect(
      flattenValidationErrors([
        error({
          property: 'options',
          constraints: { isObject: 'options must be an object' },
          children: [
            error({
              property: 'mode',
              constraints: { isEnum: 'mode is invalid' },
            }),
          ],
        }),
      ]),
    ).toStrictEqual([
      { field: 'options', messages: ['options must be an object'] },
      { field: 'options.mode', messages: ['mode is invalid'] },
    ]);
  });
});
