import { useTranslation } from 'react-i18next';
import type { ResponseWarning } from '../api';
import { warningMessageKey } from '../i18n';

/**
 * One reading of a `warnings` entry, shared by everything that shows one: the
 * translated sentence for a code this client knows, the server's own for one it
 * does not. A warning the client cannot name is still a warning worth showing.
 */
export function useWarningMessage(): (warning: ResponseWarning) => string {
  const { t } = useTranslation();

  return (warning) => {
    const key = warningMessageKey(warning.code);
    return key === null ? warning.message : t(key);
  };
}
