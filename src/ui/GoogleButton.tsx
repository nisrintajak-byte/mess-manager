import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GOOGLE_SIGNIN_ENABLED } from '../config';
import { signInWithGoogle } from '../lib/googleAuth';
import { Body, Button, Notice } from './components';

/** "Continue with Google" — hidden until Google Sign-In is configured (see config.ts). */
export function GoogleButton() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!GOOGLE_SIGNIN_ENABLED) return null;

  async function go() {
    setError(false);
    setBusy(true);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r === 'error') setError(true);
  }

  return (
    <>
      {error ? <Notice tone="error">{t('auth.googleFailed')}</Notice> : null}
      <Button title={t('auth.google')} variant="secondary" onPress={() => void go()} loading={busy} />
      <Body muted>{t('auth.googleNote')}</Body>
    </>
  );
}
