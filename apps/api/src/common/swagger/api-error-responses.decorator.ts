import { HttpStatus, applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../filters/error-response.dto';

const DESCRIPTIONS: ReadonlyMap<number, string> = new Map([
  [HttpStatus.BAD_REQUEST, 'The request failed validation.'],
  [HttpStatus.UNAUTHORIZED, 'The admin API key is missing or wrong.'],
  [HttpStatus.FORBIDDEN, 'The caller may not perform this operation.'],
  [HttpStatus.NOT_FOUND, 'No such route or resource.'],
  [
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The request is well formed but cannot be satisfied with the current rates.',
  ],
  [HttpStatus.TOO_MANY_REQUESTS, 'The rate limit for this client is spent.'],
  [
    HttpStatus.INTERNAL_SERVER_ERROR,
    'An unexpected failure. The message is generic by design.',
  ],
  [
    HttpStatus.SERVICE_UNAVAILABLE,
    'A dependency the request needs is unavailable.',
  ],
]);

// Declares the failures a route can answer with, all of them shaped as the one
// error envelope. Using it is what keeps /docs-json honest: a status a route
// can produce and does not declare here is a gap the document does not show.
export function ApiErrorResponses(
  ...statuses: HttpStatus[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description:
          DESCRIPTIONS.get(status) ?? 'The request failed; see code.',
        type: ErrorResponseDto,
      }),
    ),
  );
}
