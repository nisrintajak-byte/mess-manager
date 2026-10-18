import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { formatMoney, parseAmount } from '../lib/money';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Field, Meta, Notice, Screen, Spacer, Title } from '../ui/components';
import { useLoader } from '../ui/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'Adjust'>;

/** Admin correction for an expense in a locked cycle (PRD §11.5). */
export function AdjustScreen({ navigation, route }: Props) {
  const { roomId, expenseId } = route.params;
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useLoader(async () => {
    const [{ expense, cycle }, cycles] = await Promise.all([api.expense(expenseId), api.cycles(roomId)]);
    return { expense, cycle, open: cycles[0] };
  }, expenseId);

  if (!data) return <Screen>{null}</Screen>;
  const { expense, cycle, open } = data;
  const decimals = open?.currency_decimals ?? cycle?.currency_decimals ?? 2;
  const currency = open?.currency ?? cycle?.currency ?? expense.currency;

  async function save() {
    setError(null);
    const negative = amount.trim().startsWith('-');
    const minor = parseAmount(amount.trim().replace(/^[-+]/, ''), decimals);
    if (minor === null || minor === 0) return setError(t('errors.amount_invalid'));
    if (!reason.trim()) return setError(t('errors.reason_required'));
    setBusy(true);
    try {
      const id = await api.addAdjustment(expenseId, negative ? -minor : minor, reason);
      navigation.replace('ExpenseDetail', { roomId, expenseId: id });
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('adjust.title')}</Title>
      <Card>
        <Body>{expense.title}</Body>
        <Meta>
          {expense.expense_date} ·{' '}
          {formatMoney(expense.amount, cycle?.currency ?? currency, cycle?.currency_decimals ?? decimals)}
        </Meta>
      </Card>
      <Body muted>{t('adjust.explain')}</Body>
      <Spacer />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field
        label={t('adjust.amount', { currency })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numbers-and-punctuation"
        placeholder="-1.000"
      />
      <Field
        label={t('adjust.reason')}
        placeholder={t('adjust.reasonPlaceholder')}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={1000}
      />
      <Button title={t('adjust.save')} onPress={save} loading={busy} />
    </Screen>
  );
}
