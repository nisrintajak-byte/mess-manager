import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/AuthProvider';
import { api, Member, Room } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import { dbErrorKey } from '../lib/errors';
import { formatMinor, formatMoney, parseAmount } from '../lib/money';
import { submitOrQueue } from '../lib/outbox';
import { setPref } from '../lib/prefs';
import { isIsoDate, shiftDay, todayIn, uuid } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Chip, ChipRow, Field, Label, Notice, Screen, Spacer } from '../ui/components';
import { DateInput } from '../ui/DateInput';
import { FilePicker } from '../ui/FilePicker';

type Props = NativeStackScreenProps<AppStackParamList, 'AddExpense'>;

export function AddExpenseScreen({ navigation, route }: Props) {
  const { roomId, expenseId, needId, presetTitle } = route.params;
  const editing = !!expenseId;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id ?? '';

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState(presetTitle ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState(me);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'equal' | 'selected'>('equal');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<string | null>(null);
  const [baseUpdated, setBaseUpdated] = useState('');
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
        setBaseUpdated(expense.updated_at);
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
      const amountText = formatMoney(minor, room.currency, room.currency_decimals);
      if (editing) {
        await submitOrQueue({
          type: 'expense_edit',
          userId: me,
          roomId,
          label: title,
          amount: minor,
          amountText,
          payload: {
            expenseId,
            baseUpdated,
            title,
            amount: minor,
            date,
            notes,
            participants,
            receiptPath: receipt,
          },
        });
      } else {
        await submitOrQueue({
          id: idempotencyKey,
          type: 'expense_create',
          userId: me,
          roomId,
          label: title,
          amount: minor,
          amountText,
          payload: { title, amount: minor, date, notes, participants, receiptPath: receipt, needId },
        });
        // ticks "Add your first expense" in the Home setup list
        void setPref('firstExpense', '1');
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
  const minorNow = parseAmount(amount, room.currency_decimals);
  const people = mode === 'selected' ? selected.size : members.length;
  const each = minorNow && minorNow > 0 && people > 0 ? Math.floor(minorNow / people) : null;
  const today = todayIn(room.time_zone);
  const yesterday = shiftDay(today, -1);

  return (
    <Screen
      footer={
        <>
          <Button title={t('expense.save')} onPress={save} loading={busy} />
          {!editing ? <Body muted>{t('expense.editWindow')}</Body> : null}
        </>
      }
    >
      {/* Payer is always the member who added the expense (founder decision; enforced by the server). */}
      <Body muted>
        {room.name} ·{' '}
        {paidBy === me
          ? t('expense.paidByYou')
          : name(members.find((m) => m.user_id === paidBy) ?? ({} as Member))}
      </Body>
      <Spacer size="md" />
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
        big
        label={t('expense.amount', { currency: room.currency })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={formatMinor(0, room.currency_decimals)}
        error={errors.amount}
      />

      {/* Every expense is shared by the whole Room (founder 2026-10-21). An older expense that
          was shared by selected members keeps its people when edited. */}
      <Label>{t('split.title')}</Label>
      <Body>
        {mode === 'selected'
          ? t('split.keptSelected', {
              names: members
                .filter((m) => selected.has(m.user_id))
                .map(name)
                .join(', '),
            })
          : localizeDigits(t('split.wholeRoom', { count: members.length }))}
      </Body>
      {each !== null ? (
        <Body muted>
          {localizeDigits(
            t('expense.eachPays', { amount: formatMoney(each, room.currency, room.currency_decimals) }),
          )}
        </Body>
      ) : null}
      <Spacer />

      <Label>{t('expense.date')}</Label>
      <ChipRow>
        <Chip on={date === today} onPress={() => setDate(today)} label={t('expense.today')} />
        <Chip on={date === yesterday} onPress={() => setDate(yesterday)} label={t('expense.yesterday')} />
      </ChipRow>
      <DateInput label={t('expense.otherDate')} value={date} onChange={setDate} error={errors.date} />

      <FilePicker roomId={roomId} label={t('receipt.title')} value={receipt} onChange={setReceipt} />
      <Field label={t('expense.notes')} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
    </Screen>
  );
}
