import { TestingModuleBuilder } from '@nestjs/testing';
import { InMemoryHistoryRepository } from '../../src/modules/history/__tests__/in-memory-history.repository';
import { HISTORY_REPOSITORY } from '../../src/modules/history/domain/history-repository.port';

// Every suite converts, and every conversion writes a record, so the store is
// swapped for one that lives in the process. A suite that wants to watch the
// history degrade passes its own instance.
export function overrideHistory(
  builder: TestingModuleBuilder,
  repository: InMemoryHistoryRepository = new InMemoryHistoryRepository(),
): TestingModuleBuilder {
  return builder.overrideProvider(HISTORY_REPOSITORY).useValue(repository);
}
