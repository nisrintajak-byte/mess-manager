import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Where Supabase sends the user back after they tap an email link (confirm sign-up,
 * password reset). On phones this is the app's deep link (messmanager://). On the web it
 * must be the exact page the app is served from — e.g. the project is hosted under
 * /mess-manager/next/, so a bare origin would land on a 404. We use the current page URL
 * (no query/hash) so the redirect returns to the running app, which reads the token from
 * the URL (detectSessionInUrl).
 */
export function authRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin + window.location.pathname;
  }
  return Linking.createURL('/');
}
