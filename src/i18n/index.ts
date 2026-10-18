/**
 * Translations (PRD §16.2): every UI string lives in src/i18n/locales/*.json.
 * Arabic, Urdu and Hindi are DRAFT machine translations until professional review (PRD §28).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { localizeDigits } from '../lib/digits';
import ar from './locales/ar.json';
import en from './locales/en.json';
import hi from './locales/hi.json';
import ur from './locales/ur.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar', 'ur', 'hi'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Each language in its own script, no flags (PRD §16.1). */
export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  ar: 'العربية',
  ur: 'اردو',
  hi: 'हिन्दी',
};

const RTL: readonly AppLanguage[] = ['ar', 'ur'];
export function isRtlLanguage(lang: string): boolean {
  return (RTL as readonly string[]).includes(lang);
}

export function isSupportedLanguage(lang: string | null | undefined): lang is AppLanguage {
  return !!lang && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

// eslint-disable-next-line import/no-named-as-default-member
void i18n
  .use({ type: 'postProcessor', name: 'digits', process: (value: string) => localizeDigits(value) })
  .use(initReactI18next)
  .init({
    postProcess: ['digits'],
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      ur: { translation: ur },
      hi: { translation: hi },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
