import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Switch } from 'react-native';

import { api, OPTIONAL_NOTIFICATIONS } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { previewNeedAlert } from '../lib/needAlert';
import { PushState, registerForPush } from '../lib/push';
import { Body, Button, Card, Label, Notice, Row, Screen, Spacer, Title } from '../ui/components';
import { useLoader } from '../ui/hooks';
import { WebPushCard } from '../ui/WebPushCard';
import { colors } from '../ui/theme';

/** Optional notifications can be switched off; mandatory ones cannot (PRD §7.7). */
export function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { data, reload } = useLoader(() => api.notificationPrefs(), 'prefs');
  const [push, setPush] = useState<PushState | null>(Platform.OS === 'web' ? 'web' : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') void registerForPush().then(setPush);
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
      {push === 'on' && Platform.OS !== 'web' ? (
        <Notice tone="success">{t('notifPrefs.pushOn')}</Notice>
      ) : null}
      {push === 'unavailable' ? <Notice tone="info">{t('notifPrefs.pushWeb')}</Notice> : null}
      <WebPushCard />
      {push === 'denied' ? <Notice tone="info">{t('notifPrefs.pushDenied')}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {(data?.get('need_created') ?? true) ? (
        <Card>
          <Row>
            <Label>{t('notifPrefs.needSound')}</Label>
            <Switch
              value={data?.get('need_sound') ?? true}
              onValueChange={(v) => toggle('need_sound', v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t('notifPrefs.needSound')}
            />
          </Row>
          <Body muted>{t('notifPrefs.needSoundHelp')}</Body>
          <Button
            title={t('notifPrefs.needSoundPlay')}
            variant="secondary"
            onPress={() =>
              void previewNeedAlert(t('notifPrefs.need_created'), t('notifPrefs.needSoundPreview'))
            }
          />
        </Card>
      ) : null}
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
