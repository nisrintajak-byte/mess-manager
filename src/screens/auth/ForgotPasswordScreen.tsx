import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authErrorKey } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { isValidEmail } from '../../lib/validation';
import type { AuthStackParamList } from '../../navigation/types';
import { Body, Button, Field, Notice, Screen, Spacer, Title } from '../../ui/components';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(null);
    if (!isValidEmail(email)) {
      setError(t('auth.errors.emailInvalid'));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: Linking.createURL('/'),
    });
    setBusy(false);
    // Same message whether or not the account exists (no account enumeration).
    if (err && authErrorKey(err) === 'auth.errors.tooManyAttempts') setError(t(authErrorKey(err)));
    else setSent(true);
  }

  return (
    <Screen>
      <Title>{t('auth.forgotTitle')}</Title>
      <Body muted>{t('auth.forgotSubtitle')}</Body>
      <Spacer size="xl" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {sent ? (
        <>
          <Notice tone="success">{t('auth.resetSent', { email: email.trim() })}</Notice>
          <Button title={t('auth.signIn')} onPress={() => navigation.navigate('Login')} />
        </>
      ) : (
        <>
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Button title={t('auth.sendResetLink')} onPress={send} loading={busy} />
        </>
      )}
    </Screen>
  );
}
