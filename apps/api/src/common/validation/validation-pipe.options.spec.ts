import { validationPipeOptions } from './validation-pipe.options';
import { validationExceptionFactory } from './validation-exception-factory';

describe('validationPipeOptions', () => {
  it('strips unknown properties and rejects the request that sent them', () => {
    expect(validationPipeOptions.whitelist).toBe(true);
    expect(validationPipeOptions.forbidNonWhitelisted).toBe(true);
  });

  it('transforms payloads into DTO instances without coercing types implicitly', () => {
    expect(validationPipeOptions.transform).toBe(true);
    expect(validationPipeOptions.transformOptions).toStrictEqual({
      enableImplicitConversion: false,
    });
  });

  it('reports failures through the factory the error envelope understands', () => {
    expect(validationPipeOptions.exceptionFactory).toBe(
      validationExceptionFactory,
    );
  });
});
