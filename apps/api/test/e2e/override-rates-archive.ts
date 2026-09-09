import { TestingModuleBuilder } from '@nestjs/testing';
import { InMemoryRatesArchive } from '../../src/modules/rates/__tests__/in-memory-rates-archive.repository';
import { RATES_ARCHIVE } from '../../src/modules/rates/domain/rates-archive.interface';

// Every suite that fetches rates writes the day to the archive on its way out,
// so the store is swapped for one that lives in the process. A suite that wants
// to watch the archive answer a fallback, serve a series or degrade passes its
// own instance.
export function overrideRatesArchive(
  builder: TestingModuleBuilder,
  archive: InMemoryRatesArchive = new InMemoryRatesArchive(),
): TestingModuleBuilder {
  return builder.overrideProvider(RATES_ARCHIVE).useValue(archive);
}
