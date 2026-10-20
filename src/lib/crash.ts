import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Crash reporting without personal data (PRD §21, §25): errors go to our own `client_errors`
 * table through `log_client_error` — only the message, stack, screen, platform and app version.
 * The server also removes emails and long numbers. Never throws.
 */

const sent = new Set<string>();
let currentScreen: string | null = null;

export function setCrashScreen(name: string | null): void {
  currentScreen = name;
}

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '?';
}

export function reportError(error: unknown, screen: string | null = currentScreen): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const message = `${e.name}: ${e.message}`.slice(0, 500);
    const key = message + (screen ?? '');
    if (sent.has(key) || sent.size > 50) return; // once per error per app start
    sent.add(key);
    void supabase
      .rpc('log_client_error', {
        p_platform: Platform.OS,
        p_app_version: appVersion(),
        p_screen: screen,
        p_message: message,
        p_stack: (e.stack ?? '').slice(0, 3000),
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // reporting must never break the app
  }
}

let installed = false;

/** Catch errors that happen outside React rendering (timers, promises, event handlers). */
export function installCrashHandlers(): void {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message));
    window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
    return;
  }
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler: (h: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((error, isFatal) => {
    reportError(error);
    previous(error, isFatal);
  });
}
