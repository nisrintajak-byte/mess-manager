import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { handleAuthLink } from '../auth/AuthProvider';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-In through Supabase. Only name, email and picture are used (PRD §7.3).
 * Web: full-page redirect and back. Phone: system browser, then the app link brings the session.
 */
export async function signInWithGoogle(): Promise<'ok' | 'cancelled' | 'error'> {
  if (Platform.OS === 'web') {
    const back = window.location.href.split('#')[0]?.split('?')[0] ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: back },
    });
    return error ? 'error' : 'ok';
  }
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return 'error';
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return 'cancelled';
  return (await handleAuthLink(res.url)) ? 'ok' : 'error';
}
