import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Where Supabase sends the user back after they tap an email link (confirm sign-up,
 * password reset).
 *
 * On phones this is the app's deep link (messmanager://), which opens the app directly.
 *
 * On the web the app is served under a base path (e.g. /mess-manager/next/), so a bare
 * origin — or the live pathname after client-side navigation (e.g. /Signup) — lands on a
 * GitHub Pages 404. We build the URL from the origin plus the configured base path so the
 * link always returns to the app's own index; the SPA 404 fallback serves it and the app
 * reads the token from the URL (detectSessionInUrl). The base path matches whatever the
 * build set (experiments.baseUrl): /mess-manager for stable, /mess-manager/next for next.
 */
export function authRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
    return window.location.origin + base.replace(/\/$/, '') + '/';
  }
  return Linking.createURL('/');
}
