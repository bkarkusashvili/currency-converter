import { HttpModuleOptions } from '@nestjs/axios';
import type { TypedConfigService } from '../../../../config/typed-config.service';

// A function of its own rather than a lambda in the module: the module declares
// the wiring, and what the upstream client is allowed to do is a decision.
export function buildMonobankHttpOptions(
  config: TypedConfigService,
): HttpModuleOptions {
  return { timeout: config.get('MONOBANK_TIMEOUT_MS', { infer: true }) };
}
