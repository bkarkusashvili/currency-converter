import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ArchiveUnavailableError } from '../../../common/errors';
import {
  ArchivedPairDay,
  RateHistory,
  RateHistoryQuery,
} from '../domain/rate-history.types';
import { RATES_ARCHIVE } from '../domain/rates-archive.interface';
import type { RatesArchive } from '../domain/rates-archive.interface';
import { collectRatePoints } from './collect-rate-points.util';

@Injectable()
export class RateHistoryService {
  constructor(
    @Inject(RATES_ARCHIVE) private readonly archive: RatesArchive,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RateHistoryService.name);
  }

  // The window is read once and every decision is made from that one read: the
  // codes the archive quoted, the days the pair was published on, and the two
  // 422s between them (§3). The read is projected to the pair, so a day arrives
  // as the three numbers this answers with plus the two flags those 422s are
  // decided from, rather than as the whole published board.
  async series(query: RateHistoryQuery): Promise<RateHistory> {
    const { base, quote, days } = query;
    const archived = await this.read(query);

    return {
      base,
      quote,
      days,
      points: collectRatePoints(archived, base, quote),
    };
  }

  // The read has nothing to answer with when the store is unreachable, and a
  // driver message would carry the connection string to the client, so every
  // failure becomes the one documented outage.
  private async read(query: RateHistoryQuery): Promise<ArchivedPairDay[]> {
    try {
      return await this.archive.findPairWindow(query);
    } catch (error) {
      if (error instanceof ArchiveUnavailableError) {
        throw error;
      }

      this.logger.error({ err: error }, 'Rate snapshot archive read failed');

      throw new ArchiveUnavailableError({ reason: 'read failed' });
    }
  }
}
