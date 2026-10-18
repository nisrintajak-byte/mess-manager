import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  /** Email verification is required before joining or creating a Room (PRD §7.2). */
  emailVerified: boolean;
  /** True after opening a password-reset link: show the "set new password" screen. */
  recovering: boolean;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Read tokens from an email link (…#access_token=…&refresh_token=…&type=recovery, or ?code=…). */
async function handleAuthLink(url: string | null): Promise<'recovery' | 'signin' | null> {
  if (!url) return null;
  const parsed = new URL(url.replace('#', url.includes('?') ? '&' : '?'));
  const p = parsed.searchParams;
  const code = p.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? null : p.get('type') === 'recovery' ? 'recovery' : 'signin';
  }
  const access = p.get('access_token');
  const refresh = p.get('refresh_token');
  if (access && refresh) {
    const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) return null;
    return p.get('type') === 'recovery' ? 'recovery' : 'signin';
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const kind = await handleAuthLink(await Linking.getInitialURL()).catch(() => null);
      if (kind === 'recovery' && alive) setRecovering(true);
      const { data } = await supabase.auth.getSession();
      if (alive) {
        setSession(data.session);
        setLoading(false);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleAuthLink(url)
        .then((kind) => kind === 'recovery' && setRecovering(true))
        .catch(() => undefined);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      emailVerified: !!session?.user.email_confirmed_at,
      recovering,
      finishRecovery: () => setRecovering(false),
      signOut: async () => {
        setRecovering(false);
        await supabase.auth.signOut();
      },
    }),
    [session, loading, recovering],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
