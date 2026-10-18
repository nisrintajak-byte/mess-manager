/**
 * Translations (PRD §16.2): every UI string lives in src/i18n/locales/*.json.
 * v0.1 ships English only; ar, ur, hi are added in v0.4 with RTL.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
