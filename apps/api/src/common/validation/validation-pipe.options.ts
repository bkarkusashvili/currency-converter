import { ValidationPipeOptions } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception-factory';

export const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  // Implicit conversion would silently turn "abc" into NaN for a number field
  // and hide bad input; DTOs opt into coercion explicitly with @Type.
  transformOptions: { enableImplicitConversion: false },
  exceptionFactory: validationExceptionFactory,
};
