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

export const i18nInstance: i18n = i18next;
