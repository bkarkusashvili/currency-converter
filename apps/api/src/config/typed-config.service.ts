import { ConfigService } from '@nestjs/config';
import { AppConfig } from './app-config';

// The second type argument marks the config as validated, which makes every
// `get(key, { infer: true })` read non-nullable instead of `T | undefined`.
export type TypedConfigService = ConfigService<AppConfig, true>;
