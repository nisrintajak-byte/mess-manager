import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Field, Notice, Screen, Spacer, Title } from '../ui/components';

type Props = NativeStackScreenProps<AppStackParamList, 'JoinRoom'>;

export function JoinRoomScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await api.requestJoin(code);
      setSent(true);
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('room.joinTitle')}</Title>
      <Body muted>{t('room.joinBody')}</Body>
      <Spacer size="xl" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {sent ? (
        <>
          <Notice tone="success">{t('room.requestSent')}</Notice>
          <Button title={t('common.close')} onPress={() => navigation.goBack()} />
        </>
      ) : (
        <>
          <Field
            label={t('room.joinCodeLabel')}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <Button
            title={t('room.sendRequest')}
            onPress={send}
            loading={busy}
            disabled={code.trim().length < 8}
          />
        </>
      )}
    </Screen>
  );
}
