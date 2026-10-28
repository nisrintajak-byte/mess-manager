/**
 * Translations (PRD §16.2): every UI string lives in src/i18n/locales/*.json.
 * Arabic, Urdu and Hindi are DRAFT machine translations until professional review (PRD §28).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { PASSWORD_MIN_LENGTH } from '../config';
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
    interpolation: {
      // Not HTML escaping (React does that): in Arabic/Urdu each inserted value (a Latin name, a
      // date, an amount) is wrapped in Unicode isolate marks so it cannot reorder the words around
      // it, e.g. "أنشأها Imran 2026/10/28" showed as "2026/10/Imran 28".
      escapeValue: true,
      defaultVariables: { minPassword: PASSWORD_MIN_LENGTH },
      escape: (value: string) => (isRtlLanguage(i18n.language) ? `\u2068${value}\u2069` : value),
    },
  });

export default i18n;
