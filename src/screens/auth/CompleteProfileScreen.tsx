import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../lib/api';
import { dbErrorKey } from '../../lib/errors';
import { ageOn, CONSENT_VERSION, parseDateOfBirth } from '../../lib/validation';
import { Body, Button, Checkbox, Field, Notice, Screen, Spacer, Title } from '../../ui/components';

/** Shown once after Google Sign-In: date of birth + consent (PRD §7.1, §20.4). */
export function CompleteProfileScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [dob, setDob] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    const d = parseDateOfBirth(dob);
    if (!d) return setError(t('auth.errors.dobInvalid'));
    if (ageOn(d) < 18) return setError(t('auth.errors.minorNotYet'));
    if (!consent) return setError(t('auth.errors.consentRequired'));
    setBusy(true);
    try {
      await api.completeProfile(dob.trim(), CONSENT_VERSION);
      onDone();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Spacer size="xl" />
      <Title>{t('profile.title')}</Title>
      <Body muted>{t('profile.body')}</Body>
      <Spacer />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field
        label={t('auth.dateOfBirth')}
        value={dob}
        onChangeText={setDob}
        placeholder={t('auth.dobPlaceholder')}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />
      <Checkbox checked={consent} onToggle={() => setConsent(!consent)}>
        {t('auth.consent')}
      </Checkbox>
      <Spacer />
      <Button title={t('profile.save')} onPress={() => void save()} loading={busy} />
      <Button title={t('auth.signOut')} variant="link" onPress={() => void signOut()} />
    </Screen>
  );
}
