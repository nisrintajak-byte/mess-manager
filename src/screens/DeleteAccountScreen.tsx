import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import { dbErrorKey } from '../lib/errors';
import { isNetworkError } from '../lib/net';
import { loadOutbox, pendingCount } from '../lib/outbox';
import { requireReauth } from '../lib/reauth';
import { Body, Button, Card, Checkbox, Label, Notice, Screen, Title } from '../ui/components';
import { useLoader } from '../ui/hooks';

/** PRD §18.3: Settings → Account → Delete Account. */
export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError } = useLoader(async () => {
    await loadOutbox();
    const check = await api.accountDeletionCheck();
    return { check, unsynced: pendingCount() };
  });

  const blocking = data?.check.blocking_rooms ?? [];

  async function remove() {
    setError(null);
    if (!(await requireReauth())) return;
    setBusy(true);
    try {
      await api.deleteMyAccount();
      await signOut();
    } catch (e) {
      const msg = (e as { message?: string; code?: string }) ?? {};
      if (isNetworkError(e)) setError(t('report.needsInternet'));
      else if (msg.code === 'PGRST202') setError(t('account.notReady'));
      else setError(t(dbErrorKey(msg)));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('account.deleteTitle')}</Title>
      <Card>
        <Label>{t('account.whatHappens')}</Label>
        <Body>{t('account.what1')}</Body>
        <Body>{t('account.what2', { date: data ? localizeDigits(data.check.purge_after) : '…' })}</Body>
        <Body>{t('account.what3')}</Body>
        <Body>{t('account.what4')}</Body>
      </Card>

      {loadError ? (
        <Notice tone="error">
          {isNetworkError(loadError)
            ? t('report.needsInternet')
            : t(dbErrorKey(loadError as { message?: string }))}
        </Notice>
      ) : null}

      {blocking.length > 0 ? (
        <Notice tone="error">
          {t('account.lastAdmin', { rooms: blocking.map((r) => r.name).join(', ') })}
        </Notice>
      ) : null}
      {data && data.unsynced > 0 ? (
        <Notice tone="info">{t('account.warnUnsynced', { count: data.unsynced })}</Notice>
      ) : null}
      {data && data.check.unpaid > 0 ? (
        <Notice tone="info">{t('account.warnUnpaid', { count: data.check.unpaid })}</Notice>
      ) : null}
      {data && data.check.open_disputes > 0 ? (
        <Notice tone="info">{t('account.warnDisputes', { count: data.check.open_disputes })}</Notice>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
      <Checkbox checked={agree} onToggle={() => setAgree((v) => !v)}>
        <Body>{t('account.understand')}</Body>
      </Checkbox>
      <Button
        title={t('account.deleteButton')}
        variant="danger"
        loading={busy}
        disabled={!data || !agree || blocking.length > 0}
        onPress={() => void remove()}
      />
    </Screen>
  );
}
