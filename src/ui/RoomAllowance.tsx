import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../lib/api';
import { BILLING_SUPPORTED } from '../lib/billing';
import { localizeDigits } from '../lib/digits';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Notice } from './components';

export type Allowance = { used: number; limit: number; plus: boolean };

/** Rooms in use vs. the account's limit (free 2, Plus 10). Null while loading or offline. */
export function useRoomAllowance(): Allowance | null {
  const [a, setA] = useState<Allowance | null>(null);
  useEffect(() => {
    api
      .myRoomAllowance()
      .then(setA)
      .catch(() => setA(null));
  }, []);
  return a;
}

/**
 * On Create / Join a Room: how many Rooms are used, and when the limit is reached why, with the
 * way to Plus. The server enforces the limit too; this only explains it before the form is filled.
 */
export function RoomAllowanceNote({ allowance }: { allowance: Allowance | null }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  if (!allowance) return null;
  const full = allowance.used >= allowance.limit;
  if (!full) {
    return (
      <Body muted>{localizeDigits(t('plan.usage', { used: allowance.used, limit: allowance.limit }))}</Body>
    );
  }
  if (allowance.plus) return <Notice tone="info">{localizeDigits(t('plan.fullPlus'))}</Notice>;
  return (
    <>
      <Notice tone="info">{localizeDigits(t('plan.fullFree'))}</Notice>
      {BILLING_SUPPORTED ? (
        <Button title={t('plan.getPlus')} onPress={() => navigation.navigate('Settings', { page: 'ads' })} />
      ) : (
        <Body muted>{t('plan.appOnly')}</Body>
      )}
    </>
  );
}
