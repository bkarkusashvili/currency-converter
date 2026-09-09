import { ConfigService } from '@nestjs/config';
import { AppConfig } from './app-config.types';

// The second type argument marks the config as validated, which makes every
// `get(key, { infer: true })` read non-nullable instead of `T | undefined`.
//
// Being a type alias, this erases to `Object` in the `design:paramtypes`
// metadata TypeScript emits for decorators, so a class injecting it must name
// the runtime token itself with `@Inject(ConfigService)`.
export type TypedConfigService = ConfigService<AppConfig, true>;
