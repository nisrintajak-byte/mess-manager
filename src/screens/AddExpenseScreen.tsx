import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/AuthProvider';
import { api, Member, Room } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { formatMinor, parseAmount } from '../lib/money';
import { isIsoDate, todayIn, uuid } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import {
  Body,
  Button,
  Checkbox,
  Chip,
  ChipRow,
  Field,
  Label,
  Notice,
  Screen,
  Spacer,
  Title,
} from '../ui/components';
import { FilePicker } from '../ui/FilePicker';

type Props = NativeStackScreenProps<AppStackParamList, 'AddExpense'>;

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
  const [mode, setMode] = useState<'equal' | 'selected'>('equal');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per form: a double tap or network retry never creates two expenses.
  const idempotencyKey = useRef(uuid()).current;

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r, m] = await Promise.all([api.room(roomId), api.members(roomId)]);
      if (!alive) return;
      const approved = m.filter((x) => x.status === 'approved');
      setRoom(r);
      setMembers(approved);
      setSelected(new Set(approved.map((x) => x.user_id)));
      if (expenseId) {
        const { expense, participants } = await api.expense(expenseId);
        if (!alive) return;
        setTitle(expense.title);
        setAmount(formatMinor(expense.amount, r.currency_decimals));
        setDate(expense.expense_date);
        setPaidBy(expense.paid_by);
        setNotes(expense.notes ?? '');
        setReceipt(expense.receipt_path);
        setMode(expense.split_mode);
        if (expense.split_mode === 'selected') setSelected(new Set(participants));
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

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function save() {
    if (!room) return;
    const e: Record<string, string> = {};
    const minor = parseAmount(amount, room.currency_decimals);
    if (!title.trim()) e.title = t('expense.titleRequired');
    if (minor === null || minor <= 0)
      e.amount = t('expense.amountInvalid', { decimals: room.currency_decimals });
    if (!isIsoDate(date)) e.date = t('expense.dateInvalid');
    if (mode === 'selected' && selected.size === 0) e.split = t('split.pickOne');
    setErrors(e);
    if (Object.keys(e).length > 0 || minor === null) return;

    const participants = mode === 'selected' ? [...selected] : null;
    setServerError(null);
    setBusy(true);
    try {
      if (editing) {
        await api.editExpense({
          id: expenseId!,
          title,
          amount: minor,
          date,
          paidBy,
          notes,
          participants,
          receiptPath: receipt,
        });
      } else {
        await api.createExpense({
          roomId,
          title,
          amount: minor,
          date,
          paidBy,
          notes,
          participants,
          receiptPath: receipt,
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

  const name = (m: Member) => m.profile?.display_name ?? '—';

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

      <Label>{t('expense.paidBy')}</Label>
      <ChipRow>
        {members.map((m) => (
          <Chip
            key={m.user_id}
            on={paidBy === m.user_id}
            onPress={() => setPaidBy(m.user_id)}
            label={name(m)}
          />
        ))}
      </ChipRow>

      <Label>{t('split.title')}</Label>
      <ChipRow>
        <Chip on={mode === 'equal'} onPress={() => setMode('equal')} label={t('split.everyone')} />
        <Chip on={mode === 'selected'} onPress={() => setMode('selected')} label={t('split.selected')} />
      </ChipRow>
      {mode === 'selected' ? (
        <>
          <Body muted>{t('split.selectedHint')}</Body>
          <Spacer size="sm" />
          {members.map((m) => (
            <Checkbox key={m.user_id} checked={selected.has(m.user_id)} onToggle={() => toggle(m.user_id)}>
              <Body>{name(m)}</Body>
            </Checkbox>
          ))}
          {errors.split ? <Notice tone="error">{errors.split}</Notice> : null}
        </>
      ) : null}

      <Field label={t('expense.notes')} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      <FilePicker roomId={roomId} label={t('receipt.title')} value={receipt} onChange={setReceipt} />
      <Spacer />
      <Button title={t('expense.save')} onPress={save} loading={busy} />
      {!editing ? <Body muted>{t('expense.editWindow')}</Body> : null}
    </Screen>
  );
}
