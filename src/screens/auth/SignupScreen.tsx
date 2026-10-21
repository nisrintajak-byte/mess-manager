import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { authErrorKey } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { PASSWORD_MIN_LENGTH, TESTING_MODE } from '../../config';
import { CONSENT_VERSION, SignupErrors, validateSignup } from '../../lib/validation';
import type { AuthStackParamList } from '../../navigation/types';
import { GoogleButton } from '../../ui/GoogleButton';
import { BrandMark } from '../../ui/BrandMark';
import { DateInput } from '../../ui/DateInput';
import { Body, Button, Checkbox, Field, Notice, Screen, Spacer, Title } from '../../ui/components';
import { colors } from '../../ui/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    consent: false,
  });
  const [errors, setErrors] = useState<SignupErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const err = (key: keyof SignupErrors) => (errors[key] ? t(errors[key]!) : null);

  async function submit() {
    setServerError(null);
    const found = validateSignup(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const email = form.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: Linking.createURL('/'),
        data: {
          display_name: form.name.trim(),
          date_of_birth: form.dateOfBirth.trim(),
          language: i18n.language,
          consent_version: CONSENT_VERSION,
          consent_at: new Date().toISOString(),
        },
      },
    });
    setBusy(false);
    if (error) {
      setServerError(t(authErrorKey(error)));
      return;
    }
    // With email confirmation off (testing), Supabase signs the user in immediately and the
    // navigator switches to the app on its own. Otherwise ask them to confirm their email.
    if (!data.session) navigation.replace('CheckEmail', { email });
  }

  return (
    <Screen>
      <BrandMark />
      <Title>{t('auth.signupTitle')}</Title>
      <Body muted>{t('auth.signupSubtitle')}</Body>
      <Spacer size="xl" />
      {TESTING_MODE ? <Notice tone="info">{t('auth.testingMode')}</Notice> : null}
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      <Field
        label={t('auth.name')}
        placeholder={t('auth.namePlaceholder')}
        value={form.name}
        onChangeText={set('name')}
        autoComplete="name"
        error={err('name')}
      />
      <Field
        label={t('auth.email')}
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={err('email')}
      />
      <Field
        label={t('auth.password')}
        placeholder={t('auth.passwordHint', { count: PASSWORD_MIN_LENGTH })}
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoComplete="new-password"
        error={err('password')}
      />
      <Field
        label={t('auth.confirmPassword')}
        value={form.confirmPassword}
        onChangeText={set('confirmPassword')}
        secureTextEntry
        autoComplete="new-password"
        error={err('confirmPassword')}
      />
      <DateInput
        label={t('auth.dateOfBirth')}
        value={form.dateOfBirth}
        onChange={set('dateOfBirth')}
        error={err('dateOfBirth')}
      />
      <Checkbox
        checked={form.consent}
        onToggle={() => setForm((f) => ({ ...f, consent: !f.consent }))}
        error={err('consent')}
      >
        <Body>{t('auth.consent')}</Body>
        <Text>
          <Text
            style={{ color: colors.primary }}
            onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
          >
            {t('auth.privacyPolicy')}
          </Text>
          <Text style={{ color: colors.textMuted }}>{'  ·  '}</Text>
          <Text
            style={{ color: colors.primary }}
            onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
          >
            {t('auth.terms')}
          </Text>
        </Text>
      </Checkbox>
      <Button title={t('auth.signUp')} onPress={submit} loading={busy} />
      <Button title={t('auth.haveAccount')} variant="link" onPress={() => navigation.navigate('Login')} />
      <Spacer />
      <GoogleButton />
    </Screen>
  );
}
