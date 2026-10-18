import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Switch } from 'react-native';

import { api, OPTIONAL_NOTIFICATIONS } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { PushState, registerForPush } from '../lib/push';
import { Body, Card, Notice, Row, Screen, Spacer, Title } from '../ui/components';
import { useLoader } from '../ui/hooks';
import { colors } from '../ui/theme';

/** Optional notifications can be switched off; mandatory ones cannot (PRD §7.7). */
export function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { data, reload } = useLoader(() => api.notificationPrefs(), 'prefs');
  const [push, setPush] = useState<PushState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') setPush('web');
    else void registerForPush().then(setPush);
  }, []);

  async function toggle(kind: string, enabled: boolean) {
    setError(null);
    try {
      await api.setNotificationPref(kind, enabled);
      await reload();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    }
  }

  return (
    <Screen>
      <Title>{t('notifPrefs.title')}</Title>
      {push === 'on' ? <Notice tone="success">{t('notifPrefs.pushOn')}</Notice> : null}
      {push === 'web' || push === 'unavailable' ? (
        <Notice tone="info">{t('notifPrefs.pushWeb')}</Notice>
      ) : null}
      {push === 'denied' ? <Notice tone="info">{t('notifPrefs.pushDenied')}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Body muted>{t('notifPrefs.intro')}</Body>
      <Spacer />
      {OPTIONAL_NOTIFICATIONS.map((kind) => {
        const on = data?.get(kind) ?? true;
        return (
          <Card key={kind}>
            <Row>
              <Body>{t(`notifPrefs.${kind}`)}</Body>
              <Switch
                value={on}
                onValueChange={(v) => toggle(kind, v)}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={t(`notifPrefs.${kind}`)}
              />
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
