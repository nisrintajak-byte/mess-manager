import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, Member, Room } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { formatMinor, parseAmount } from '../lib/money';
import { isIsoDate, todayIn, uuid } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Field, Notice, Screen, Spacer, Title } from '../ui/components';
import { colors, font, space } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AddExpense'>;

// Categories removed from the form (founder decision 2026-10-18); stored as 'general'.
const CATEGORY = 'general';

export function AddExpenseScreen({ navigation, route }: Props) {
  const { roomId, expenseId } = route.params;
  const editing = !!expenseId;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id ?? '';

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState(me);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per form instance: a double-tap or network retry never creates two expenses.
  const idempotencyKey = useRef(uuid()).current;

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r, m] = await Promise.all([api.room(roomId), api.members(roomId)]);
      if (!alive) return;
      setRoom(r);
      setMembers(m.filter((x) => x.status === 'approved'));
      if (expenseId) {
        const { expense } = await api.expense(expenseId);
        if (!alive) return;
        setTitle(expense.title);
        setAmount(formatMinor(expense.amount, r.currency_decimals));
        setDate(expense.expense_date);
        setPaidBy(expense.paid_by);
        setNotes(expense.notes ?? '');
      } else {
        setDate(todayIn(r.time_zone));
      }
    })().catch(() => setServerError(t('common.genericError')));
    return () => {
      alive = false;
    };
  }, [roomId, expenseId, t]);

  useEffect(() => {
    navigation.setOptions({ title: t(editing ? 'expense.editTitle' : 'expense.addTitle') });
  }, [navigation, editing, t]);

  async function save() {
    if (!room) return;
    const e: Record<string, string> = {};
    const minor = parseAmount(amount, room.currency_decimals);
    if (!title.trim()) e.title = t('expense.titleRequired');
    if (minor === null || minor <= 0)
      e.amount = t('expense.amountInvalid', { decimals: room.currency_decimals });
    if (!isIsoDate(date)) e.date = t('expense.dateInvalid');
    setErrors(e);
    if (Object.keys(e).length > 0 || minor === null) return;

    setServerError(null);
    setBusy(true);
    try {
      if (editing) {
        await api.updateExpense({
          id: expenseId!,
          title,
          amount: minor,
          category: CATEGORY,
          date,
          paidBy,
          notes,
        });
      } else {
        await api.addExpense({
          roomId,
          title,
          amount: minor,
          category: CATEGORY,
          date,
          paidBy,
          notes,
          idempotencyKey,
        });
      }
      navigation.goBack();
    } catch (err) {
      setServerError(t(dbErrorKey(err as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  if (!room) {
    return (
      <Screen>
        {serverError ? <Notice tone="error">{serverError}</Notice> : <Body muted>{t('common.loading')}</Body>}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t(editing ? 'expense.editTitle' : 'expense.addTitle')}</Title>
      <Spacer />
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      <Field
        label={t('expense.title')}
        placeholder={t('expense.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        error={errors.title}
      />
      <Field
        label={t('expense.amount', { currency: room.currency })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={formatMinor(0, room.currency_decimals)}
        error={errors.amount}
      />

      <Field
        label={t('expense.date')}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        error={errors.date}
      />

      <Text style={styles.label}>{t('expense.paidBy')}</Text>
      <View style={styles.chips}>
        {members.map((m) => (
          <Chip
            key={m.user_id}
            on={paidBy === m.user_id}
            onPress={() => setPaidBy(m.user_id)}
            label={m.profile?.display_name ?? '—'}
          />
        ))}
      </View>
      <Spacer />

      <Field label={t('expense.notes')} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      <Notice tone="info">{t('expense.split')}</Notice>
      <Button title={t('expense.save')} onPress={save} loading={busy} />
      {!editing ? <Body muted>{t('expense.editWindow')}</Body> : null}
    </Screen>
  );
}

function Chip({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: font.sm },
  chipTextOn: { color: colors.primaryText },
});
