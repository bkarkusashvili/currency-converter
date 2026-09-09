import { AppConfig } from './app-config.types';
import { envSchema } from './env.schema';

// Docker Compose and CI runners pass unset variables through as empty strings;
// dropping them lets the schema defaults apply instead of failing validation.
function withoutBlankValues(
  env: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([, value]) => !(typeof value === 'string' && value.trim().length === 0),
    ),
  );
}

export function validateEnv(env: Record<string, unknown>): AppConfig {
  const result = envSchema.safeParse(withoutBlankValues(env));

  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues
    .map((issue) => {
      const variable = issue.path.map(String).join('.') || '(root)';
      return `  - ${variable}: ${issue.message}`;
    })
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${problems}`);
}
