import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RateHistory, RateHistoryPoint } from '../domain/rate-history.types';

// One archived day of one pair. It carries what the upstream published that
// day and nothing else: a spread, or a mid rate, never both (§5) — which is
// why all three numbers are optional here while at least one is always present.
export class RateHistoryPointDto implements RateHistoryPoint {
  @ApiProperty({
    description:
      'The UTC day this point is the archived snapshot of, `YYYY-MM-DD`. ' +
      'One point per day; a day the archive has no snapshot for is absent ' +
      'rather than null, so a gap is visible as a gap.',
    example: '2026-09-08',
  })
  date!: string;

  @ApiPropertyOptional({
    description: 'What the bank paid in `quote` for one unit of `base`.',
    example: 44.35,
  })
  buy?: number;

  @ApiPropertyOptional({
    description: 'What the bank charged in `quote` for one unit of `base`.',
    example: 44.831,
  })
  sell?: number;

  @ApiPropertyOptional({
    description:
      'Mid rate, published instead of a buy and sell pair for the currencies ' +
      'the bank quotes without a spread.',
    example: 60.7562,
  })
  cross?: number;
}

export class RatesHistoryResponseDto implements RateHistory {
  @ApiProperty({
    description: 'The `base` that was asked for, upper-cased.',
    example: 'USD',
  })
  base!: string;

  @ApiProperty({
    description: 'The `quote` that was asked for, upper-cased.',
    example: 'UAH',
  })
  quote!: string;

  @ApiProperty({
    description:
      'The window that was read, in UTC days counting today as the first. ' +
      'Echoed so a client that relied on the default knows what it got.',
    example: 7,
  })
  days!: number;

  @ApiProperty({
    description:
      'One point per archived day inside the window that published this ' +
      'pair, oldest first. Shorter than `days` whenever the archive has a ' +
      'gap — the API was down, or had not been deployed yet — and empty ' +
      'when no day in the window is archived yet, which is not the same as ' +
      'a pair the archive has never published (that answers 422 instead).',
    type: [RateHistoryPointDto],
    example: [
      { date: '2026-09-07', buy: 44.3, sell: 44.79 },
      { date: '2026-09-08', buy: 44.35, sell: 44.831 },
    ],
  })
  points!: RateHistoryPointDto[];
}
