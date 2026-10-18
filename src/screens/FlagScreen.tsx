import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, FlagReason } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Chip, ChipRow, Field, Label, Notice, Screen, Spacer, Title } from '../ui/components';
import { FilePicker } from '../ui/FilePicker';

type Props = NativeStackScreenProps<AppStackParamList, 'Flag'>;

/** Any approved member can flag an expense, a payment or a settlement line (PRD §12). */
export function FlagScreen({ navigation, route }: Props) {
  const { roomId, type, targetId } = route.params;
  const { t } = useTranslation();
  const reasons: FlagReason[] =
    type === 'payment'
      ? ['payment_not_received', 'wrong_amount', 'duplicate', 'other']
      : ['wrong_amount', 'not_shared', 'duplicate', 'other'];
  const [reason, setReason] = useState<FlagReason>(reasons[0]!);
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (reason === 'other' && !note.trim()) return setError(t('errors.reason_required'));
    setBusy(true);
    try {
      await api.raiseFlag({ type, targetId, reason, note, evidencePath: evidence });
      navigation.replace('Disputes', { roomId });
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('flag.title')}</Title>
      <Body muted>{t('flag.explain')}</Body>
      <Spacer />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Label>{t('flag.reason')}</Label>
      <ChipRow>
        {reasons.map((r) => (
          <Chip key={r} on={reason === r} onPress={() => setReason(r)} label={t(`flag.r_${r}`)} />
        ))}
      </ChipRow>
      <Field
        label={t('flag.note')}
        placeholder={t('flag.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
      />
      <FilePicker roomId={roomId} label={t('flag.evidence')} value={evidence} onChange={setEvidence} />
      <Spacer />
      <Button title={t('flag.submit')} onPress={submit} loading={busy} />
    </Screen>
  );
}
