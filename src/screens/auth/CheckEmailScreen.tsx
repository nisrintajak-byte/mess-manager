import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authErrorKey } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';
import { Body, Button, Notice, Screen, Spacer, Title } from '../../ui/components';

type Props = NativeStackScreenProps<AuthStackParamList, 'CheckEmail'>;

export function CheckEmailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { email } = route.params;
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: Linking.createURL('/') },
    });
    setBusy(false);
    setNotice(
      error
        ? { tone: 'error', text: t(authErrorKey(error)) }
        : { tone: 'success', text: t('auth.verifyResent') },
    );
  }

  return (
    <Screen>
      <Spacer size="xl" />
      <Title>{t('auth.verifyTitle')}</Title>
      <Body>{t('auth.verifyBody', { email })}</Body>
      <Spacer size="xl" />
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      <Button
        title={t('auth.verifyDone')}
        onPress={() => navigation.replace('Login', { notice: t('auth.signupDone', { email }) })}
      />
      <Button title={t('auth.verifyResend')} variant="secondary" onPress={resend} loading={busy} />
    </Screen>
  );
}
