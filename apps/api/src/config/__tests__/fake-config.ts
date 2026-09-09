import type { AppConfig } from '../app-config.types';
import type { TypedConfigService } from '../typed-config.service';

// One config double for every spec that needs one. It answers from the values
// it was handed and `undefined` for anything else, which is what makes a unit
// under test reading a variable the spec never set show up as a failure rather
// than as a silently plausible default.
//
// `TypedConfigService` is a type alias, so there is nothing to instantiate; the
// cast is the only way to hand a plain object to a `ConfigService` parameter.
export function fakeConfig(values: Partial<AppConfig>): TypedConfigService {
  return {
    get: (key: keyof AppConfig): unknown => values[key],
  } as unknown as TypedConfigService;
}
