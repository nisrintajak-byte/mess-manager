import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { I18nManager, Platform } from 'react-native';
import * as Expo from 'expo';

import i18n, { isRtlLanguage, isSupportedLanguage, type AppLanguage } from '../i18n';
import { THEME_NAMES, applyTheme, type ThemeName } from '../ui/theme';
import { configureDigits } from './digits';
import { getPref, setPref } from './prefs';

export type DigitStyle = 'latin' | 'arabic';

type SettingsState = {
  language: AppLanguage;
  theme: ThemeName;
  digits: DigitStyle;
  /** Bumped on every change; the app root uses it as a React key so the whole UI re-renders. */
  rev: number;
  /** Native only: layout direction changed and needs an app restart to take effect. */
  restartNeeded: boolean;
};

let state: SettingsState = { language: 'en', theme: 'light', digits: 'latin', rev: 0, restartNeeded: false };
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

/** Returns true when the native layout direction differs from what the language needs. */
function applyDirection(lang: AppLanguage): boolean {
  const rtl = isRtlLanguage(lang);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return false;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    return true;
  }
  return false;
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
  applyTheme(themeName);
  const restartNeeded = applyDirection(language);
  emit({ language, theme: themeName, digits: digits === 'arabic' ? 'arabic' : 'latin', restartNeeded });
}

export async function setLanguage(language: AppLanguage): Promise<void> {
  await setPref('lang', language);
  await i18n.changeLanguage(language);
  const restartNeeded = applyDirection(language);
  emit({ language, restartNeeded: restartNeeded || state.restartNeeded });
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

/** Restart the native app so the new layout direction applies. Falls back to a manual restart. */
export async function restartApp(): Promise<boolean> {
  const reload = (Expo as unknown as { reloadAppAsync?: () => Promise<void> }).reloadAppAsync;
  if (!reload) return false;
  try {
    await reload();
    return true;
  } catch {
    return false;
  }
}
