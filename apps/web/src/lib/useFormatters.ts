import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createFormatters, type Formatters } from './createFormatters';

/** Number and date formatting follows the active i18n language, not a hardcoded locale. */
export function useFormatters(): Formatters {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => createFormatters(language), [language]);
}
