import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, PaymentMethod } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { formatMinor, formatMoney, parseAmount } from '../lib/money';
import { uuid } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import {
  Body,
  Button,
  Chip,
  ChipRow,
  Field,
  Label,
  Meta,
  Notice,
  Screen,
  Spacer,
  Title,
} from '../ui/components';
import { FilePicker } from '../ui/FilePicker';
import { useLoader } from '../ui/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'Pay'>;
const METHODS: PaymentMethod[] = ['bank', 'wallet', 'cash', 'other'];

/** Member claims a payment with proof (PRD §11.4), or an Admin records money received. */
export function PayScreen({ navigation, route }: Props) {
  const { roomId, settlementId, lineId, mode } = route.params;
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(uuid()).current;

  const { data } = useLoader(async () => {
    const s = await api.settlement(settlementId);
    const line = s.lines.find((l) => l.line_id === lineId)!;
    const left = Math.max(-line.net, 0) - line.confirmed - line.awaiting;
    return { ...s, line, left };
  }, lineId);

  if (!data) return <Screen>{null}</Screen>;
  const { settlement, left } = data;
  const money = (v: number) => formatMoney(v, settlement.currency, settlement.currency_decimals);

  async function submit() {
    setError(null);
    const minor = parseAmount(
      amount || formatMinor(left, settlement.currency_decimals),
      settlement.currency_decimals,
    );
    if (minor === null || minor <= 0 || minor > left) return setError(t('errors.amount_invalid'));
    if (mode === 'claim' && method !== 'cash' && !reference.trim() && !proof) {
      return setError(t('payment.proofRequired'));
    }
    setBusy(true);
    try {
      if (mode === 'claim') {
        await api.claimPayment({
          lineId,
          amount: minor,
          method,
          reference,
          proofPath: proof,
          note,
          idempotencyKey,
        });
      } else {
        await api.recordPayment({ lineId, amount: minor, method, reference, note });
      }
      navigation.goBack();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t(mode === 'claim' ? 'payment.claimTitle' : 'payment.recordTitle')}</Title>
      <Meta>{t('payment.maxAmount', { amount: money(left) })}</Meta>
      <Spacer />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field
        label={t('payment.amount', { currency: settlement.currency })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={formatMinor(left, settlement.currency_decimals)}
      />
      <Label>{t('payment.method')}</Label>
      <ChipRow>
        {METHODS.map((m) => (
          <Chip key={m} on={method === m} onPress={() => setMethod(m)} label={t(`payment.method_${m}`)} />
        ))}
      </ChipRow>
      {method === 'cash' ? (
        <Body muted>{t('payment.cashNote')}</Body>
      ) : mode === 'claim' ? (
        <Body muted>{t('payment.proofRequired')}</Body>
      ) : null}
      <Spacer size="sm" />
      {method !== 'cash' ? (
        <Field
          label={t('payment.reference')}
          placeholder={t('payment.referencePlaceholder')}
          value={reference}
          onChangeText={setReference}
          maxLength={120}
        />
      ) : null}
      {mode === 'claim' && method !== 'cash' ? (
        <FilePicker roomId={roomId} label={t('payment.proof')} value={proof} onChange={setProof} />
      ) : null}
      <Field label={t('payment.note')} value={note} onChangeText={setNote} maxLength={500} />
      <Button
        title={t(mode === 'claim' ? 'payment.submit' : 'payment.submitRecord')}
        onPress={submit}
        loading={busy}
      />
    </Screen>
  );
}
