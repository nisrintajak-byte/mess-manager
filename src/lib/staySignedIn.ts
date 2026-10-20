import { getPref, setPref } from './prefs';
import { supabase } from './supabase';

/**
 * "Keep me signed in" (PRD §7.1). When switched off at login, the next time the app starts
 * (or the web page is opened again) the sign-in on this phone is removed first — useful on a
 * shared phone. Default: stay signed in.
 */
export async function setStaySignedIn(stay: boolean): Promise<void> {
  await setPref('staySignedIn', stay ? '1' : '0');
}

/** Called once when the app starts, before the saved sign-in is used. */
export async function forgetSignInIfAsked(): Promise<void> {
  if ((await getPref('staySignedIn')) !== '0') return;
  await setPref('staySignedIn', '1');
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}
