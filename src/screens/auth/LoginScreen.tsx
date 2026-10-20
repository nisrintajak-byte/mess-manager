import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../lib/api';
import { setStaySignedIn } from '../../lib/staySignedIn';
import { authErrorKey } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { GoogleButton } from '../../ui/GoogleButton';
import { LanguagePicker } from '../../ui/LanguagePicker';
import { Body, Button, Checkbox, Field, Notice, Screen, Spacer, Title } from '../../ui/components';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stay, setStay] = useState(true);

  async function signIn() {
    if (!email || !password) return;
    setError(null);
    setBusy(true);
    const mail = email.trim();
    // PRD §7.1: 5 wrong passwords lock this email for 15 minutes
    const wait = await api.loginWait(mail).catch(() => 0);
    if (wait > 0) {
      setBusy(false);
      setError(t('auth.lockedFor', { minutes: Math.ceil(wait / 60) }));
      return;
    }
    await setStaySignedIn(stay);
    const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (err) {
      const key = authErrorKey(err);
      if (key === 'auth.errors.invalidCredentials') {
        const locked = await api.loginFailed(mail).catch(() => 0);
        setError(locked > 0 ? t('auth.lockedFor', { minutes: Math.ceil(locked / 60) }) : t(key));
      } else setError(t(key));
    } else {
      void api.loginSucceeded().catch(() => undefined);
    }
    setBusy(false);
  }

  return (
    <Screen>
      <LanguagePicker />
      <Spacer size="xl" />
      <Title>{t('auth.loginTitle')}</Title>
      <Body muted>{t('auth.loginSubtitle')}</Body>
      <Spacer size="xl" />
      {route.params?.notice ? <Notice tone="success">{route.params.notice}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={signIn}
      />
      <Checkbox checked={stay} onToggle={() => setStay((v) => !v)}>
        <Body>{t('auth.stay')}</Body>
      </Checkbox>
      <Button title={t('auth.signIn')} onPress={signIn} loading={busy} disabled={!email || !password} />
      <Button
        title={t('auth.forgot')}
        variant="link"
        onPress={() => navigation.navigate('ForgotPassword', { email })}
      />
      <Spacer />
      <GoogleButton />
      <Spacer size="xl" />
      <Button title={t('auth.noAccount')} variant="secondary" onPress={() => navigation.navigate('Signup')} />
    </Screen>
  );
}
