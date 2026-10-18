import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/AuthProvider';
import {
  LOCK_TIMEOUTS_MIN,
  biometricAvailable,
  clearLock,
  enableLock,
  getLockConfig,
  lockSupported,
  setLockOptions,
  subscribeLock,
  type LockConfig,
  DEFAULT_LOCK,
} from '../lib/appLock';
import { requireReauth } from '../lib/reauth';
import { supabase } from '../lib/supabase';
import { passwordError, pinError } from '../lib/validation';
import { Body, Button, Card, Chip, ChipRow, Field, Label, Notice, Spacer } from './components';

/** Settings card: turn App Lock (PIN / fingerprint) on or off and choose when it asks again. */
export function AppLockCard() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<LockConfig>(DEFAULT_LOCK);
  const [bio, setBio] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [wantBio, setWantBio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => setCfg(await getLockConfig()), []);
  useEffect(() => {
    void reload();
    void biometricAvailable().then(setBio);
    return subscribeLock(() => void reload());
  }, [reload]);

  if (!lockSupported) {
    return (
      <Card>
        <Label>{t('lock.title')}</Label>
        <Body muted>{t('lock.unsupportedWeb')}</Body>
      </Card>
    );
  }

  async function turnOn() {
    setError(null);
    const pe = pinError(pin);
    if (pe) return setError(t(pe));
    if (pin !== pin2) return setError(t('lock.pinMismatch'));
    setBusy(true);
    await enableLock(pin, wantBio && bio, cfg.timeoutMin);
    setBusy(false);
    setPin('');
    setPin2('');
  }

  async function turnOff() {
    if (!(await requireReauth())) return;
    await clearLock();
  }

  return (
    <Card>
      <Label>{t('lock.title')}</Label>
      <Body muted>{t('lock.explain')}</Body>
      <Spacer size="sm" />
      {cfg.enabled ? (
        <>
          <Notice tone="success">{t('lock.enabledNote')}</Notice>
          <Label>{t('lock.timeout')}</Label>
          <ChipRow>
            {LOCK_TIMEOUTS_MIN.map((m) => (
              <Chip
                key={m}
                on={cfg.timeoutMin === m}
                label={t(`lock.timeout_${m}`)}
                onPress={() => void setLockOptions({ timeoutMin: m })}
              />
            ))}
          </ChipRow>
          {bio ? (
            <>
              <Spacer size="sm" />
              <Chip
                on={cfg.biometric}
                label={t('lock.useBiometric')}
                onPress={() => void setLockOptions({ biometric: !cfg.biometric })}
              />
            </>
          ) : null}
          <Spacer />
          <Button title={t('lock.disable')} variant="secondary" onPress={() => void turnOff()} />
        </>
      ) : (
        <>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field
            label={t('lock.pin')}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
          />
          <Field
            label={t('lock.pinConfirm')}
            value={pin2}
            onChangeText={(v) => setPin2(v.replace(/\D/g, ''))}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
          />
          {bio ? (
            <Chip on={wantBio} label={t('lock.useBiometric')} onPress={() => setWantBio(!wantBio)} />
          ) : null}
          <Spacer size="sm" />
          <Button
            title={t('lock.enable')}
            onPress={() => void turnOn()}
            loading={busy}
            disabled={pin.length < 4}
          />
        </>
      )}
    </Card>
  );
}

/** Settings card: change password (needs re-authentication). Hidden for Google-only accounts. */
export function ChangePasswordCard() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasPassword = !!session?.user.identities?.some((i) => i.provider === 'email');
  if (!hasPassword) return null;

  async function save() {
    setError(null);
    setDone(false);
    const pe = passwordError(pw);
    if (pe) return setError(t(pe));
    if (pw !== pw2) return setError(t('auth.errors.passwordMismatch'));
    if (!(await requireReauth())) return;
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(t('common.genericError'));
    setPw('');
    setPw2('');
    setDone(true);
  }

  return (
    <Card>
      <Label>{t('password.title')}</Label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {done ? <Notice tone="success">{t('password.done')}</Notice> : null}
      <Field
        label={t('password.new')}
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        autoCapitalize="none"
      />
      <Field
        label={t('password.confirm')}
        value={pw2}
        onChangeText={setPw2}
        secureTextEntry
        autoCapitalize="none"
      />
      <Button title={t('password.save')} onPress={() => void save()} loading={busy} disabled={!pw || !pw2} />
    </Card>
  );
}
