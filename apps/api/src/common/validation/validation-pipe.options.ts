import { ValidationPipeOptions } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception-factory';

export const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  // Implicit conversion would silently turn "abc" into NaN for a number field
  // and hide bad input; DTOs opt into coercion explicitly with @Type.
  transformOptions: { enableImplicitConversion: false },
  // One mistake, one message. Every rule a wrong value breaks is reported
  // otherwise, and the extra ones are noise derived from the same mistake: an
  // amount sent as "100" failed the type check, and that it is also "not less
  // than a trillion" is a consequence of NaN, not a second thing to fix. This
  // is per field, not per request — `details.errors` still carries an entry for
  // every bad field.
  //
  // It only reads well because the DTOs declare the type check last, which is
  // where class-validator starts: the constraints are evaluated bottom-up, so
  // the first failure recorded is the one the others follow from.
  stopAtFirstError: true,
  exceptionFactory: validationExceptionFactory,
};
