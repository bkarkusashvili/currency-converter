import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ArchiveUnavailableError } from '../../../common/errors';
import {
  ArchivedSnapshot,
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
  // 422s between them (§3).
  async series({ base, quote, days }: RateHistoryQuery): Promise<RateHistory> {
    const snapshots = await this.read(days);

    return {
      base,
      quote,
      days,
      points: collectRatePoints(snapshots, base, quote),
    };
  }

  // The read has nothing to answer with when the store is unreachable, and a
  // driver message would carry the connection string to the client, so every
  // failure becomes the one documented outage.
  private async read(days: number): Promise<ArchivedSnapshot[]> {
    try {
      return await this.archive.findWindow(days);
    } catch (error) {
      if (error instanceof ArchiveUnavailableError) {
        throw error;
      }

      this.logger.error({ err: error }, 'Rate snapshot archive read failed');

      throw new ArchiveUnavailableError({ reason: 'read failed' });
    }
  }
}
