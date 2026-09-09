import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

const defaultNS = 'translation';

const resources = { en: { translation: en } } as const;

void i18next.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: { escapeValue: false },
});

/**
 * `index.html` ships `lang="en"` so the document is never unlabelled, but the
 * language the page is actually rendered in is i18next's, and a screen reader
 * picks its voice from the attribute. Adding a second language therefore means
 * a JSON file and a switch, with nothing left hardcoded in the markup.
 */
function syncDocumentLanguage(): void {
  document.documentElement.lang = i18next.resolvedLanguage ?? 'en';
}

syncDocumentLanguage();
i18next.on('languageChanged', syncDocumentLanguage);

export const i18nInstance: i18n = i18next;

/**
 * The two code → message-key maps a component reaches for through this index,
 * so nothing outside `i18n/` names a file inside it.
 */
export { API_ERROR_CODES, errorMessageKey } from './errorMessageKey';
export type { ApiErrorCode, ErrorMessageKey } from './errorMessageKey';
export { warningMessageKey } from './warningMessageKey';
export type { WarningMessageKey } from './warningMessageKey';
