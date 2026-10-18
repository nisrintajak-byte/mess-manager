import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authErrorKey } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { GoogleButton } from '../../ui/GoogleButton';
import { LanguagePicker } from '../../ui/LanguagePicker';
import { Body, Button, Field, Notice, Screen, Spacer, Title } from '../../ui/components';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email || !password) return;
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(t(authErrorKey(err)));
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
