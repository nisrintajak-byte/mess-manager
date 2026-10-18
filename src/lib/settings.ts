import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { I18nManager, Platform } from 'react-native';

import i18n, { isRtlLanguage, isSupportedLanguage, type AppLanguage } from '../i18n';
import { loadFontsFor } from '../ui/fonts';
import { THEME_NAMES, applyRtl, applyTheme, type ThemeName } from '../ui/theme';
import { configureDigits } from './digits';
import { getPref, setPref } from './prefs';

export type DigitStyle = 'latin' | 'arabic';

type SettingsState = {
  language: AppLanguage;
  theme: ThemeName;
  digits: DigitStyle;
  /** Bumped on every change; the app root uses it as a React key so the whole UI re-renders. */
  rev: number;
};

let state: SettingsState = { language: 'en', theme: 'light', digits: 'latin', rev: 0 };
const listeners = new Set<() => void>();

function emit(patch: Partial<SettingsState>) {
  state = { ...state, ...patch, rev: state.rev + 1 };
  configureDigits(state.language, state.digits);
  listeners.forEach((l) => l());
}

export function getSettings(): SettingsState {
  return state;
}

export function useSettings(): SettingsState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => state,
  );
}

/**
 * Layout direction. Web: the browser mirrors via `dir`. Phone: Android's own mirroring stays OFF
 * and the app mirrors itself (see theme.ts), so switching language needs no restart.
 */
function applyDirection(lang: AppLanguage): void {
  const rtl = isRtlLanguage(lang);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    applyRtl(false);
    return;
  }
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
  applyRtl(rtl);
}

function deviceLanguage(): AppLanguage {
  try {
    const code = getLocales()[0]?.languageCode;
    if (isSupportedLanguage(code)) return code;
  } catch {
    // fall through
  }
  return 'en';
}

/** Run once before the first render. */
export async function loadSettings(): Promise<void> {
  const [lang, theme, digits] = await Promise.all([getPref('lang'), getPref('theme'), getPref('digits')]);
  const language = isSupportedLanguage(lang) ? lang : deviceLanguage();
  const themeName = (THEME_NAMES as readonly string[]).includes(theme ?? '') ? (theme as ThemeName) : 'light';
  await i18n.changeLanguage(language);
  await loadFontsFor(language);
  applyTheme(themeName);
  applyDirection(language);
  emit({ language, theme: themeName, digits: digits === 'arabic' ? 'arabic' : 'latin' });
}

export async function setLanguage(language: AppLanguage): Promise<void> {
  await setPref('lang', language);
  await i18n.changeLanguage(language);
  await loadFontsFor(language);
  applyDirection(language);
  emit({ language });
}

export async function setTheme(theme: ThemeName): Promise<void> {
  await setPref('theme', theme);
  applyTheme(theme);
  emit({ theme });
}

export async function setDigits(digits: DigitStyle): Promise<void> {
  await setPref('digits', digits);
  emit({ digits });
}
