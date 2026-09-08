import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { HistoryUnavailableError } from '../../common/errors/history-unavailable.error';
import { ConversionRecord } from './domain/conversion-record';
import type { NewConversionRecord } from './domain/conversion-record';
import type { HistoryRepository } from './domain/history-repository.port';
import { HISTORY_REPOSITORY } from './domain/history-repository.token';

@Injectable()
export class HistoryService {
  constructor(
    @Inject(HISTORY_REPOSITORY) private readonly repository: HistoryRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(HistoryService.name);
  }

  // The conversion is the answer and the record is a side effect of it (§2), so
  // this resolves whatever the store did. The catch is not a second line of
  // defence for the adapter's own degradation but the guarantee itself: any
  // repository bound to the port keeps this promise, however it fails.
  //
  // The parameter is the port's own type rather than the conversion module's
  // `ConversionResult`, which is structurally the same thing: a conversion
  // hands over what it answered and the history module does not have to know
  // where it came from.
  async record(entry: NewConversionRecord): Promise<void> {
    try {
      await this.repository.record(entry);
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Conversion history write escaped the repository; the conversion is unaffected',
      );
    }
  }

  // The read has nothing to answer with when the store is unreachable, and a
  // driver message would carry the connection string to the client, so every
  // failure becomes the one documented outage.
  async recent(limit: number): Promise<ConversionRecord[]> {
    try {
      return await this.repository.findRecent(limit);
    } catch (error) {
      if (error instanceof HistoryUnavailableError) {
        throw error;
      }

      this.logger.error({ err: error }, 'Conversion history read failed');

      throw new HistoryUnavailableError({ reason: 'read failed' });
    }
  }
}
