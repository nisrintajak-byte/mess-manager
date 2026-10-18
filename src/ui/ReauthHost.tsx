import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import {
  authenticateBiometric,
  biometricAvailable,
  getLockConfig,
  lockSupported,
  verifyPin,
} from '../lib/appLock';
import { createAttemptLimiter } from '../lib/attemptLimiter';
import { registerReauthHandler } from '../lib/reauth';
import { supabase } from '../lib/supabase';
import { Body, Button, Field, Notice, Spacer, Title } from './components';
import { colors, radius, space, themedStyles } from './theme';

type Method = 'password' | 'pin' | 'none';

/** Mount once. Shows the "confirm it's you" prompt for sensitive actions (see lib/reauth.ts). */
export function ReauthHost() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>('password');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const limiter = useRef(createAttemptLimiter(5, 30_000)).current;
  const email = session?.user.email ?? '';
  const hasPassword = !!session?.user.identities?.some((i) => i.provider === 'email');

  const finish = useCallback((ok: boolean) => {
    setOpen(false);
    setSecret('');
    setError(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  useEffect(() => {
    registerReauthHandler(async () => {
      const cfg = await getLockConfig();
      let m: Method = hasPassword ? 'password' : cfg.enabled ? 'pin' : 'none';
      if (m === 'pin' && cfg.biometric && (await biometricAvailable())) {
        if (await authenticateBiometric(t('reauth.title'))) return true;
      }
      if (!hasPassword && !cfg.enabled) m = 'none';
      setMethod(m);
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    });
    return () => registerReauthHandler(null);
  }, [hasPassword, t]);

  async function submit() {
    if (limiter.secondsLeft() > 0) {
      setError(t('lock.tooMany', { seconds: limiter.secondsLeft() }));
      return;
    }
    setBusy(true);
    let ok = false;
    if (method === 'password') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: secret });
      ok = !err;
    } else if (method === 'pin' && lockSupported) {
      ok = await verifyPin(secret);
    }
    setBusy(false);
    if (ok) {
      limiter.reset();
      finish(true);
    } else {
      limiter.fail();
      setSecret('');
      setError(t('reauth.wrong'));
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish(false)}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Title>{t('reauth.title')}</Title>
          {method === 'none' ? (
            <Notice tone="info">{t('reauth.noMethod')}</Notice>
          ) : (
            <>
              <Body muted>{t(method === 'password' ? 'reauth.passwordBody' : 'reauth.pinBody')}</Body>
              <Spacer />
              {error ? <Notice tone="error">{error}</Notice> : null}
              <Field
                label={t(method === 'password' ? 'auth.password' : 'lock.pinLabel')}
                value={secret}
                onChangeText={setSecret}
                secureTextEntry
                keyboardType={method === 'pin' ? 'number-pad' : 'default'}
                autoCapitalize="none"
                autoFocus
                onSubmitEditing={() => void submit()}
              />
              <Button
                title={t('common.confirm')}
                onPress={() => void submit()}
                loading={busy}
                disabled={!secret}
              />
            </>
          )}
          <Button title={t('common.cancel')} variant="link" onPress={() => finish(false)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: space.lg,
    },
    box: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
  }),
);
