import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import {
  DEFAULT_LOCK,
  authenticateBiometric,
  biometricAvailable,
  getLockConfig,
  lockSupported,
  subscribeLock,
  verifyPin,
  type LockConfig,
} from '../lib/appLock';
import { createAttemptLimiter } from '../lib/attemptLimiter';
import { Body, Button, Field, Notice, Spacer, Title } from './components';
import { colors, space, themedStyles } from './theme';

/**
 * Covers the app with a PIN / fingerprint screen when App Lock is on: at start, and after the app
 * has been in the background longer than the chosen time (PRD §7.4). The app underneath stays
 * mounted so nothing is lost; it is just not visible or reachable while locked.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [cfg, setCfg] = useState<LockConfig | null>(lockSupported ? null : DEFAULT_LOCK);
  const [locked, setLocked] = useState(lockSupported);
  const cfgRef = useRef<LockConfig>(DEFAULT_LOCK);
  const wentAway = useRef<number | null>(null);

  useEffect(() => {
    if (!lockSupported) return;
    const apply = (c: LockConfig, initial: boolean) => {
      cfgRef.current = c;
      setCfg(c);
      if (initial) setLocked(c.enabled);
      else if (!c.enabled) setLocked(false);
    };
    void getLockConfig().then((c) => apply(c, true));
    return subscribeLock(() => void getLockConfig().then((c) => apply(c, false)));
  }, []);

  useEffect(() => {
    if (!lockSupported) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        if (wentAway.current === null) wentAway.current = Date.now();
      } else if (next === 'active') {
        const since = wentAway.current;
        wentAway.current = null;
        const c = cfgRef.current;
        if (c.enabled && since !== null && Date.now() - since >= c.timeoutMin * 60_000) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const showLock = lockSupported && locked && !!session && (cfg === null || cfg.enabled);

  return (
    <View style={fill}>
      {children}
      {showLock ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
          <LockScreen cfg={cfg} onUnlock={() => setLocked(false)} />
        </View>
      ) : null}
    </View>
  );
}

const fill = { flex: 1 } as const;

function LockScreen({ cfg, onUnlock }: { cfg: LockConfig | null; onUnlock: () => void }) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [limiter] = useState(() => createAttemptLimiter());
  const bioTried = useRef(false);

  const tryBiometric = useCallback(async () => {
    if (!(await biometricAvailable())) return;
    if (await authenticateBiometric(t('lock.biometricPrompt'))) onUnlock();
  }, [onUnlock, t]);

  useEffect(() => {
    if (cfg?.biometric && !bioTried.current) {
      bioTried.current = true;
      void tryBiometric();
    }
  }, [cfg?.biometric, tryBiometric]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(limiter.secondsLeft()), 1000);
    return () => clearInterval(id);
  }, [wait, limiter]);

  async function submit() {
    if (limiter.secondsLeft() > 0) return;
    if (await verifyPin(pin)) {
      limiter.reset();
      onUnlock();
      return;
    }
    limiter.fail();
    setPin('');
    setWait(limiter.secondsLeft());
    setError(t('lock.wrongPin'));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.column}>
        <Title>{t('lock.unlockTitle')}</Title>
        <Body muted>{t('app.name')}</Body>
        <Spacer />
        {error ? (
          <Notice tone="error">{wait > 0 ? t('lock.tooMany', { seconds: wait }) : error}</Notice>
        ) : null}
        <Field
          label={t('lock.pinLabel')}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={8}
          autoFocus
          onSubmitEditing={() => void submit()}
        />
        <Button
          title={t('lock.unlock')}
          onPress={() => void submit()}
          disabled={pin.length < 4 || wait > 0}
        />
        {cfg?.biometric ? (
          <Button title={t('lock.useBiometricBtn')} variant="secondary" onPress={() => void tryBiometric()} />
        ) : null}
        <Spacer />
        <Button title={t('lock.forgot')} variant="link" onPress={() => void signOut()} />
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: colors.bg },
    column: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  }),
);
