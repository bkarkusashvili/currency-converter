import { HttpModuleOptions } from '@nestjs/axios';
import type { TypedConfigService } from '../../../../config/typed-config.service';

// Two orders of magnitude more than the ~30 KB the upstream publishes, and a
// ceiling where there was none: the timeout bounds how long a response may take
// and nothing bounded how large it may be, so a compromised or misconfigured
// `MONOBANK_API_URL` could stream an arbitrary body into memory inside the
// budget — and zod would then walk whatever arrived.
const MAX_RESPONSE_BYTES = 2_000_000;

// A function of its own rather than a lambda in the module: the module declares
// the wiring, and what the upstream client is allowed to do is a decision.
export function buildMonobankHttpOptions(
  config: TypedConfigService,
): HttpModuleOptions {
  return {
    timeout: config.get('MONOBANK_TIMEOUT_MS', { infer: true }),
    maxContentLength: MAX_RESPONSE_BYTES,
    maxBodyLength: MAX_RESPONSE_BYTES,
  };
}
