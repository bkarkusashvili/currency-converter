import { useTranslation } from 'react-i18next';
import type { ApiError } from '../api';
import { errorMessageKey } from '../i18n';

/**
 * One reading of the envelope, shared by everything that shows a failure: the
 * translated message for a code this client knows, the server's own text for
 * one it does not. Reading `error.message` directly is how "Cannot GET
 * /api/v1/currencies" reached the page.
 */
export function useApiErrorMessage(): (error: ApiError) => string {
  const { t } = useTranslation();

  return (error) => {
    const key = errorMessageKey(error.code);
    return key === null ? error.message : t(key, { replace: error.details });
  };
}
