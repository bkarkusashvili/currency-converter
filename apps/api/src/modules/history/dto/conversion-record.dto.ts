import { ApiProperty, OmitType } from '@nestjs/swagger';
import { ConvertResponseDto } from '../../conversion/dto/convert-response.dto';
import { ConversionRecord } from '../domain/conversion-record';

// A record is the conversion that was answered plus the two fields the store
// owns, and this says so rather than re-describing eight properties the convert
// response already describes — a second copy of those descriptions is one that
// drifts from the first, and §3 publishes them as the same fields.
//
// `warnings` is the one part of an answer that is not part of the conversion:
// it says what degraded while the request ran, which is a fact about that
// request rather than about what was converted. The record has never carried it
// and `NewConversionRecord` has no place for it.
//
// `@nestjs/swagger` copies the decorated properties of the base into the
// schema, so `swagger.e2e-spec.ts` — which asserts every field of this DTO is
// required and both enums are present — is the guard on this being equivalent.
export class ConversionRecordDto
  extends OmitType(ConvertResponseDto, ['warnings'] as const)
  implements ConversionRecord
{
  @ApiProperty({
    description: 'Identifier of the stored record.',
    example: '6f0000000000000000000001',
  })
  id!: string;

  @ApiProperty({
    description:
      'When the conversion was recorded, ISO 8601. Read with ' +
      '`ratesTimestamp` it is how old the quote was when it was used.',
    example: '2026-09-08T12:00:05.000Z',
  })
  createdAt!: string;
}
