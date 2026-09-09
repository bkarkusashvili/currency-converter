import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from '../errors';

// A class rather than an interface so @ApiResponse can point at it: an
// interface is erased before Swagger ever sees it, which left
// components.schemas empty and every failure undocumented.
export class ErrorResponseDto {
  @ApiProperty({
    description: 'The HTTP status of the response, repeated in the body.',
    example: 422,
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'Stable machine readable cause. One of the documented ErrorCodes; an ' +
      'unmapped 4xx is named after the failure instead.',
    example: ErrorCode.UNSUPPORTED_CURRENCY,
  })
  code!: string;

  @ApiProperty({
    description:
      'Human readable summary. Generic for a 5xx, where the detail stays in ' +
      'the log.',
    example: "Currency 'XYZ' is not supported",
  })
  message!: string;

  @ApiPropertyOptional({
    description:
      'Structured context for the failure. Validation failures carry ' +
      'details.errors, a list of field and messages pairs.',
    example: { currency: 'XYZ' },
    additionalProperties: true,
    type: 'object',
  })
  details?: Record<string, unknown>;

  @ApiProperty({
    description: 'When the response was produced, ISO 8601.',
    example: '2026-09-08T12:00:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'The path that was requested.',
    example: '/api/v1/convert',
  })
  path!: string;

  @ApiPropertyOptional({
    description:
      'Echoed in the x-request-id header and on every log line for the ' +
      'request, so a report can be traced to its logs.',
    example: '8b5a2f0e-1f2c-4a35-9f0c-2f4d8b6e7a91',
  })
  requestId?: string;
}
