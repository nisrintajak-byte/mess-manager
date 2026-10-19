import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { enableWebPush, webPushState, type WebPushState } from '../lib/webPush';
import { Body, Button, Card, Label, Notice } from './components';

/**
 * Browser version only: turn on phone notifications (Need Requests, expenses, settlements…).
 * `compact` = show only while the user has not decided yet (Home screen).
 */
export function WebPushCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [state, setState] = useState<WebPushState>(() =>
    Platform.OS === 'web' ? webPushState() : 'unsupported',
  );
  const [busy, setBusy] = useState(false);
  if (Platform.OS !== 'web') return null;
  if (compact && state !== 'ask') return null;

  async function enable() {
    setBusy(true);
    setState(await enableWebPush());
    setBusy(false);
  }

  return (
    <Card>
      <Label>{t('webPush.title')}</Label>
      {state === 'on' ? <Notice tone="success">{t('webPush.on')}</Notice> : null}
      {state === 'ask' ? (
        <>
          <Body muted>{t('webPush.explain')}</Body>
          <Button title={t('webPush.enable')} loading={busy} onPress={() => void enable()} />
        </>
      ) : null}
      {state === 'denied' ? <Notice tone="info">{t('webPush.denied')}</Notice> : null}
      {state === 'unsupported' ? <Notice tone="info">{t('webPush.unsupported')}</Notice> : null}
    </Card>
  );
}
