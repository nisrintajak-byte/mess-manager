import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../auth/AuthProvider';
import { LEGAL_VERSION, legalTexts } from '../../legal';
import { api } from '../../lib/api';
import { dbErrorKey } from '../../lib/errors';
import { isNetworkError } from '../../lib/net';
import { Body, Button, Card, Checkbox, Notice, Screen, Spacer, Title } from '../../ui/components';
import { LegalBody } from '../../ui/LegalBody';

/** The Privacy Policy or Terms changed: the user accepts the new version before continuing. */
export function ConsentUpdateScreen({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const texts = legalTexts(i18n.language);
  const [open, setOpen] = useState<'privacy' | 'terms' | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setBusy(true);
    try {
      await api.acceptLegal(LEGAL_VERSION);
      onDone();
    } catch (e) {
      setError(isNetworkError(e) ? t('report.needsInternet') : t(dbErrorKey(e as { message?: string })));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Spacer size="xl" />
      <Title>{t('legal.updateTitle')}</Title>
      <Body muted>{t('legal.updateBody')}</Body>
      {(['privacy', 'terms'] as const).map((doc) => (
        <Card key={doc}>
          <Button
            title={
              open === doc
                ? t('legal.hide', { doc: texts[doc].title })
                : t('legal.read', { doc: texts[doc].title })
            }
            variant="link"
            onPress={() => setOpen(open === doc ? null : doc)}
          />
          {open === doc ? <LegalBody doc={doc} /> : null}
        </Card>
      ))}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Checkbox checked={agree} onToggle={() => setAgree(!agree)}>
        <Body>{t('auth.consent')}</Body>
      </Checkbox>
      <Button title={t('legal.accept')} disabled={!agree} loading={busy} onPress={() => void accept()} />
      <Button title={t('auth.signOut')} variant="link" onPress={() => void signOut()} />
    </Screen>
  );
}
