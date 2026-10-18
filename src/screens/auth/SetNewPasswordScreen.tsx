import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../auth/AuthProvider';
import { PASSWORD_MIN_LENGTH } from '../../config';
import { authErrorKey } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { passwordError } from '../../lib/validation';
import { Body, Button, Field, Notice, Screen, Spacer, Title } from '../../ui/components';

export function SetNewPasswordScreen() {
  const { t } = useTranslation();
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const pw = passwordError(password);
    if (pw) return setError(t(pw));
    if (password !== confirm) return setError(t('auth.errors.passwordMismatch'));
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(t(authErrorKey(err)));
    finishRecovery();
  }

  return (
    <Screen>
      <Spacer size="xl" />
      <Title>{t('auth.newPasswordTitle')}</Title>
      <Body muted>{t('auth.passwordHint', { count: PASSWORD_MIN_LENGTH })}</Body>
      <Spacer size="xl" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Field
        label={t('auth.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
      />
      <Button title={t('common.save')} onPress={save} loading={busy} />
    </Screen>
  );
}
